import { act, renderHook } from '@testing-library/react-native';

import {
  useSwipeableInterstitialAd,
  useSwipeableInterstitialAdState,
} from './useSwipeableInterstitialAd';

const mockUseReleasingSharedObject = jest.fn();

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
  NativeObjects: { SwipeableInterstitialAd: jest.fn() },
}));
jest.mock('../initialization', () => ({ runWhenInitialized: jest.fn() }));

let nextSharedObjectId = 1;

function makeAd(overrides: any = {}) {
  const listeners = new Set<(payload: any) => void>();
  return {
    status: 'loading',
    minScreenHoldDuration: 0,
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

describe('useSwipeableInterstitialAdState', () => {
  it('reports the ad state it starts out in', async () => {
    const ad = makeAd({ status: 'loaded', minScreenHoldDuration: 5 });

    const { result } = await renderHook(() => useSwipeableInterstitialAdState(ad));

    expect(result.current.isLoaded).toBe(true);
    expect(result.current.minScreenHoldDuration).toBe(5);
  });

  it('follows the ad through statusChange', async () => {
    const ad = makeAd();

    const { result } = await renderHook(() => useSwipeableInterstitialAdState(ad));
    expect(result.current.isLoaded).toBe(false);

    await act(async () => {
      ad.status = 'loaded';
      ad.minScreenHoldDuration = 5;
      ad.emitStatusChange();
    });

    expect(result.current.isLoaded).toBe(true);
    expect(result.current.minScreenHoldDuration).toBe(5);
  });

  it('isLoaded is false and returns the error on error', async () => {
    const error = { code: 3, message: 'No fill', domain: 'com.google.admob' };
    const ad = makeAd({ status: 'error', error });

    const { result } = await renderHook(() => useSwipeableInterstitialAdState(ad));

    expect(result.current.isLoaded).toBe(false);
    expect(result.current.error).toBe(error);
  });

  it('resets to the new ad state when a different ad is passed', async () => {
    const loaded = makeAd({ status: 'loaded', minScreenHoldDuration: 5 });
    const failed = { code: 3, message: 'No fill', domain: 'com.google.admob' };

    const { result, rerender } = await renderHook(
      (ad: any) => useSwipeableInterstitialAdState(ad),
      {
        initialProps: loaded,
      }
    );
    expect(result.current.isLoaded).toBe(true);

    await act(async () => rerender(makeAd({ status: 'loading' })));

    expect(result.current.isLoaded).toBe(false);
    expect(result.current.minScreenHoldDuration).toBe(0);

    await act(async () => rerender(makeAd({ status: 'error', error: failed })));
    expect(result.current.error).toBe(failed);
    await act(async () => rerender(makeAd({ status: 'loading' })));
    expect(result.current.error).toBeUndefined();
  });

  it('reports an empty state for a released ad instead of throwing', async () => {
    const ad = makeAd({ minScreenHoldDuration: 5 });
    Object.defineProperty(ad, 'status', {
      get() {
        throw new Error('Unable to find the native shared object');
      },
    });

    const { result } = await renderHook(() => useSwipeableInterstitialAdState(ad));

    expect(result.current.isLoaded).toBe(false);
  });

  it('does not create an ad when one is passed in', async () => {
    await renderHook(() => useSwipeableInterstitialAdState(makeAd()));

    expect(mockUseReleasingSharedObject).not.toHaveBeenCalled();
  });
});

describe('useSwipeableInterstitialAd', () => {
  it('uses Expo ownership and keys the ad on unit, dimensions and hold duration', async () => {
    const ad = makeAd();
    mockUseReleasingSharedObject.mockReturnValue(ad);
    const { result } = await renderHook(() =>
      useSwipeableInterstitialAd({
        adUnitId: 'unit',
        size: { width: 360, height: 720 },
        maxScreenHoldDuration: 5,
      })
    );
    expect(result.current.ad).toBe(ad);
    expect(mockUseReleasingSharedObject.mock.calls[0][1]).toEqual(['unit', 360, 720, 5]);
  });

  it('normalizes default hold duration and excludes requestOptions from dependencies', async () => {
    mockUseReleasingSharedObject.mockReturnValue(makeAd());
    await renderHook(() =>
      useSwipeableInterstitialAd({ adUnitId: 'unit', requestOptions: { keywords: ['game'] } })
    );
    expect(mockUseReleasingSharedObject.mock.calls[0][1]).toEqual([
      'unit',
      undefined,
      undefined,
      0,
    ]);
  });
});
