import { act, renderHook } from '@testing-library/react-native';

import { useNativeAd, useNativeAdState } from './useNativeAd';

const mockUseReleasingSharedObject = jest.fn();
const mockUseEventListener = jest.fn();

// Mirrors expo's own useEventListener (node_modules/expo/src/hooks/useEvent.ts) and matches
// useBannerAd.test.tsx: re-subscribes whenever the emitter changes, and always calls the
// latest listener. Wrapped so tests can still assert on the subscribe call itself.
jest.mock('expo', () => {
  const { useEffect, useRef } = require('react');
  return {
    useEventListener: (emitter: any, eventName: string, listener: any) => {
      mockUseEventListener(emitter, eventName, listener);
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
  NativeObjects: {
    // Gives ads created via `new NativeObjects.NativeAd(...)` (the `useNativeAd`
    // factory) the same addListener/remove shape as makeAd, since useEventListener now
    // subscribes for real.
    NativeAd: jest.fn().mockImplementation(() => ({
      addListener: jest.fn(() => ({ remove: jest.fn() })),
    })),
  },
}));
jest.mock('../initialization', () => ({ runWhenInitialized: jest.fn() }));

function makeAd(status = 'loading', error?: unknown) {
  const listeners = new Set<(payload: any) => void>();
  return {
    status,
    error,
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
  } as any;
}

beforeEach(() => jest.clearAllMocks());

describe('useNativeAdState', () => {
  it('reports isLoaded false while loading', async () => {
    const { result } = await renderHook(() => useNativeAdState(makeAd('loading')));
    expect(result.current.isLoaded).toBe(false);
  });

  it('reports isLoaded true once loaded', async () => {
    const { result } = await renderHook(() => useNativeAdState(makeAd('loaded')));
    expect(result.current.isLoaded).toBe(true);
  });

  it('reports isLoaded false after a load failure', async () => {
    const { result } = await renderHook(() => useNativeAdState(makeAd('error')));
    expect(result.current.isLoaded).toBe(false);
  });

  it('exposes the error', async () => {
    const error = { code: 3, message: 'No fill', domain: 'ExpoGoogleMobileAds' };
    const { result } = await renderHook(() => useNativeAdState(makeAd('error', error)));
    expect(result.current.error).toBe(error);
  });

  it('subscribes to statusChange on the ad', async () => {
    const ad = makeAd('loading');
    await renderHook(() => useNativeAdState(ad));
    expect(mockUseEventListener).toHaveBeenCalledWith(ad, 'statusChange', expect.any(Function));
  });

  // This is the actual mechanism by which the hook ever updates: the native side fires
  // statusChange, and the hook must re-read the ad and re-render with the new state.
  it('updates isLoaded when the ad emits statusChange', async () => {
    const ad = makeAd('loading');
    const { result } = await renderHook(() => useNativeAdState(ad));
    expect(result.current.isLoaded).toBe(false);

    await act(async () => {
      ad.status = 'loaded';
      ad.emitStatusChange();
    });

    expect(result.current.isLoaded).toBe(true);
  });

  it('resets its state when handed a different ad', async () => {
    const first = makeAd('loaded');
    const { result, rerender } = await renderHook((ad: any) => useNativeAdState(ad), {
      initialProps: first,
    });
    expect(result.current.isLoaded).toBe(true);

    await rerender(makeAd('loading'));

    expect(result.current.isLoaded).toBe(false);
  });

  it('does not create an ad', async () => {
    await renderHook(() => useNativeAdState(makeAd('loaded')));
    expect(mockUseReleasingSharedObject).not.toHaveBeenCalled();
  });

  // Every property getter of a released shared object throws SharedObject.NotFoundException,
  // which would propagate straight out of the render. A caller can legitimately still be
  // holding (and rendering) an ad it just released.
  it('reports an empty state for a released ad instead of throwing', async () => {
    const ad = makeAd('loaded');
    Object.defineProperty(ad, 'status', {
      get() {
        throw new Error('Unable to find the native shared object');
      },
    });

    const { result } = await renderHook(() => useNativeAdState(ad));

    expect(result.current.isLoaded).toBe(false);
  });
});

describe('useNativeAd', () => {
  it('creates the ad through useReleasingSharedObject and returns it', async () => {
    const ad = makeAd('loading');
    mockUseReleasingSharedObject.mockReturnValue(ad);

    const { result } = await renderHook(() => useNativeAd({ adUnitId: 'unit' }));

    expect(mockUseReleasingSharedObject).toHaveBeenCalledTimes(1);
    expect(result.current.ad).toBe(ad);
  });

  it('keys the ad on the ad unit id', async () => {
    mockUseReleasingSharedObject.mockReturnValue(makeAd('loading'));
    await renderHook(() => useNativeAd({ adUnitId: 'unit' }));
    expect(mockUseReleasingSharedObject.mock.calls[0][1]).toEqual(['unit']);
  });

  it('reads assets from the native object', async () => {
    const ad = makeAd('loaded');
    ad.assets = { headline: 'Test', mediaAspectRatio: 1.5 };
    const { result } = await renderHook(() => useNativeAdState(ad));
    expect(result.current.assets).toEqual(ad.assets);
  });
});
