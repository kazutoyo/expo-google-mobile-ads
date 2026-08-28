import { act, renderHook } from '@testing-library/react-native';

import { useBannerAd, useBannerAdState } from './useBannerAd';

const mockUseReleasingSharedObject = jest.fn();

// Mirrors expo's own useEventListener (node_modules/expo/src/hooks/useEvent.ts): re-subscribes
// whenever the emitter changes, and always calls the latest listener.
jest.mock('expo', () => {
  const { useEffect, useRef } = require('react');
  return {
    useEventListener: (emitter: any, eventName: string, listener: any) => {
      const listenerRef = useRef(listener);
      listenerRef.current = listener;
      useEffect(() => {
        const subscription = emitter.addListener(eventName, (...args: any[]) =>
          listenerRef.current(...args)
        );
        return () => subscription.remove();
      }, [emitter, eventName]);
    },
  };
});
jest.mock('expo-modules-core', () => ({
  useReleasingSharedObject: (...args: any[]) => mockUseReleasingSharedObject(...args),
}));
jest.mock('../ExpoGoogleMobileAdsModule', () => ({
  __esModule: true,
  default: { BannerAd: jest.fn() },
}));
jest.mock('../initialization', () => ({ runWhenInitialized: jest.fn() }));

const size = { width: 360, height: 50 };

let nextSharedObjectId = 1;

function makeAd(overrides: any = {}) {
  const listeners = new Set<(payload: any) => void>();
  return {
    status: 'loading',
    // release() does NOT zero this out (see `isReleased` in BannerAd.ts); ids handed out by the
    // registry start at 1, so 0 could only ever mean "never set".
    __expo_shared_object_id__: nextSharedObjectId++,
    load: jest.fn(),
    markLoadFailed: jest.fn(),
    addListener(_eventName: string, listener: (payload: any) => void) {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    },
    /** Stands in for the native side emitting statusChange after updating its own state. */
    emitStatusChange() {
      listeners.forEach((listener) => listener({ status: this.status, error: this.error }));
    },
    ...overrides,
  } as any;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useBannerAdState', () => {
  it('reports the ad state it starts out in', async () => {
    const ad = makeAd({ status: 'loaded', loadedSize: size });

    const { result } = await renderHook(() => useBannerAdState(ad));

    expect(result.current.isLoaded).toBe(true);
    expect(result.current.loadedSize).toEqual(size);
  });

  it('follows the ad through statusChange', async () => {
    const ad = makeAd();

    const { result } = await renderHook(() => useBannerAdState(ad));
    expect(result.current.isLoaded).toBe(false);

    await act(async () => {
      ad.status = 'loaded';
      ad.loadedSize = size;
      ad.emitStatusChange();
    });

    expect(result.current.isLoaded).toBe(true);
    expect(result.current.loadedSize).toEqual(size);
  });

  it('isLoaded is false and returns the error on error', async () => {
    const error = { code: 3, message: 'No fill', domain: 'com.google.admob' };
    const ad = makeAd({ status: 'error', error });

    const { result } = await renderHook(() => useBannerAdState(ad));

    expect(result.current.isLoaded).toBe(false);
    expect(result.current.error).toBe(error);
  });

  // useBannerAd recreates the ad whenever adUnitId/size changes (a rotation with
  // useBannerAdSize does exactly that), and the state of the previous ad used to carry over —
  // isLoaded stayed true for an ad that was still loading, so `{isLoaded && <BannerAdView/>}`
  // rendered a blank banner.
  it('resets to the new ad state when a different ad is passed', async () => {
    const loaded = makeAd({ status: 'loaded', loadedSize: size });
    const failed = { code: 3, message: 'No fill', domain: 'com.google.admob' };

    const { result, rerender } = await renderHook((ad: any) => useBannerAdState(ad), {
      initialProps: loaded,
    });
    expect(result.current.isLoaded).toBe(true);

    await act(async () => rerender(makeAd({ status: 'loading' })));

    expect(result.current.isLoaded).toBe(false);
    expect(result.current.loadedSize).toBeUndefined();

    // ...and an error does not survive the swap either.
    await act(async () => rerender(makeAd({ status: 'error', error: failed })));
    expect(result.current.error).toBe(failed);
    await act(async () => rerender(makeAd({ status: 'loading' })));
    expect(result.current.error).toBeUndefined();
  });

  // Every property getter of a released shared object throws SharedObject.NotFoundException,
  // which would propagate straight out of the render. Its id, note, is NOT cleared — a
  // released ad keeps reporting the one it had, so only a probe detects it.
  it('reports an empty state for a released ad instead of throwing', async () => {
    const ad = makeAd({ loadedSize: size });
    Object.defineProperty(ad, 'status', {
      get() {
        throw new Error('Unable to find the native shared object');
      },
    });

    const { result } = await renderHook(() => useBannerAdState(ad));

    expect(result.current.isLoaded).toBe(false);
  });

  it('does not create an ad when one is passed in', async () => {
    await renderHook(() => useBannerAdState(makeAd()));

    expect(mockUseReleasingSharedObject).not.toHaveBeenCalled();
  });
});

describe('useBannerAd', () => {
  it('creates and returns the ad via useReleasingSharedObject', async () => {
    const ad = makeAd();
    mockUseReleasingSharedObject.mockReturnValue(ad);

    const { result } = await renderHook(() => useBannerAd({ adUnitId: 'unit', size }));

    expect(mockUseReleasingSharedObject).toHaveBeenCalledTimes(1);
    expect(result.current.ad).toBe(ad);
  });

  // `toEqual` treats a trailing `undefined` as absent, so asserting three entries would pass
  // even if `adaptiveKind` were dropped from the dependency array. Pin all four explicitly.
  it('includes adUnitId, size and adaptiveKind in the dependency array', async () => {
    mockUseReleasingSharedObject.mockReturnValue(makeAd());

    await renderHook(() => useBannerAd({ adUnitId: 'unit', size }));

    expect(mockUseReleasingSharedObject.mock.calls[0][1]).toEqual(['unit', 360, 50, undefined]);
    expect(mockUseReleasingSharedObject.mock.calls[0][1]).toHaveLength(4);
  });

  // An adaptive size can share width and height with a fixed one, so adaptiveKind is what keeps
  // the ad from being recreated as (or left as) the wrong kind of request.
  it('carries adaptiveKind into the dependency array', async () => {
    mockUseReleasingSharedObject.mockReturnValue(makeAd());

    await renderHook(() =>
      useBannerAd({ adUnitId: 'unit', size: { ...size, adaptiveKind: 'anchoredPortrait' } })
    );

    expect(mockUseReleasingSharedObject.mock.calls[0][1]).toEqual([
      'unit',
      360,
      50,
      'anchoredPortrait',
    ]);
  });
});
