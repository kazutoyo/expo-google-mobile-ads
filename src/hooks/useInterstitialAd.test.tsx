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
  default: {
    // Gives ads created via `new NativeModule.InterstitialAd(...)` (the `useInterstitialAd`
    // factory) the same addListener/remove shape as makeAd, since useEventListener now
    // subscribes for real.
    InterstitialAd: jest.fn().mockImplementation(() => ({
      addListener: jest.fn(() => ({ remove: jest.fn() })),
    })),
  },
}));
jest.mock('../initialization', () => ({ runWhenInitialized: jest.fn() }));

import { act, renderHook } from '@testing-library/react-native';

import { useInterstitialAd, useInterstitialAdState } from './useInterstitialAd';

function makeAd(status = 'loading', error?: unknown) {
  const listeners = new Set<(payload: any) => void>();
  return {
    status,
    error,
    load: jest.fn(),
    markLoadFailed: jest.fn(),
    showAsync: jest.fn(),
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

describe('useInterstitialAdState', () => {
  it('reports isLoaded false while loading', async () => {
    const { result } = await renderHook(() => useInterstitialAdState(makeAd('loading')));
    expect(result.current.isLoaded).toBe(false);
  });

  it('reports isLoaded true once loaded', async () => {
    const { result } = await renderHook(() => useInterstitialAdState(makeAd('loaded')));
    expect(result.current.isLoaded).toBe(true);
  });

  it('reports isLoaded false once shown', async () => {
    const { result } = await renderHook(() => useInterstitialAdState(makeAd('shown')));
    expect(result.current.isLoaded).toBe(false);
  });

  it('exposes the error', async () => {
    const error = { code: 3, message: 'No fill', domain: 'ExpoGoogleMobileAds' };
    const { result } = await renderHook(() => useInterstitialAdState(makeAd('error', error)));
    expect(result.current.error).toBe(error);
  });

  it('subscribes to statusChange on the ad', async () => {
    const ad = makeAd('loading');
    await renderHook(() => useInterstitialAdState(ad));
    expect(mockUseEventListener).toHaveBeenCalledWith(ad, 'statusChange', expect.any(Function));
  });

  // This is the actual mechanism by which the hook ever updates: the native side fires
  // statusChange, and the hook must re-read the ad and re-render with the new state.
  it('updates isLoaded when the ad emits statusChange', async () => {
    const ad = makeAd('loading');
    const { result } = await renderHook(() => useInterstitialAdState(ad));
    expect(result.current.isLoaded).toBe(false);

    await act(async () => {
      ad.status = 'loaded';
      ad.emitStatusChange();
    });

    expect(result.current.isLoaded).toBe(true);
  });

  it('resets its state when handed a different ad', async () => {
    const first = makeAd('loaded');
    const { result, rerender } = await renderHook((ad: any) => useInterstitialAdState(ad), {
      initialProps: first,
    });
    expect(result.current.isLoaded).toBe(true);

    await rerender(makeAd('loading'));

    expect(result.current.isLoaded).toBe(false);
  });

  it('does not create an ad', async () => {
    await renderHook(() => useInterstitialAdState(makeAd('loaded')));
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

    const { result } = await renderHook(() => useInterstitialAdState(ad));

    expect(result.current.isLoaded).toBe(false);
  });
});

describe('useInterstitialAd', () => {
  it('creates the ad through useReleasingSharedObject and returns it', async () => {
    const ad = makeAd('loading');
    mockUseReleasingSharedObject.mockReturnValue(ad);

    const { result } = await renderHook(() => useInterstitialAd({ adUnitId: 'unit' }));

    expect(mockUseReleasingSharedObject).toHaveBeenCalledTimes(1);
    expect(result.current.ad).toBe(ad);
  });

  it('keys the ad on the ad unit id', async () => {
    mockUseReleasingSharedObject.mockReturnValue(makeAd('loading'));
    await renderHook(() => useInterstitialAd({ adUnitId: 'unit' }));
    expect(mockUseReleasingSharedObject.mock.calls[0][1]).toEqual(['unit']);
  });

  // The factory casts the native object straight to InterstitialAd; without calling
  // attachShow, `show` is never actually put on the object, so `ad.show` would be
  // undefined and calling it would throw.
  it('attaches a working show() to the created ad', async () => {
    mockUseReleasingSharedObject.mockImplementation((factory: () => any) => factory());

    const { result } = await renderHook(() => useInterstitialAd({ adUnitId: 'unit' }));

    expect(typeof result.current.ad.show).toBe('function');
  });
});
