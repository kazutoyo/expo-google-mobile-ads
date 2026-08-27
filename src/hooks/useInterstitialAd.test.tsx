const mockUseReleasingSharedObject = jest.fn();
const mockUseEventListener = jest.fn();

jest.mock('expo', () => ({
  useEventListener: (...args: any[]) => mockUseEventListener(...args),
}));
jest.mock('expo-modules-core', () => ({
  useReleasingSharedObject: (...args: any[]) => mockUseReleasingSharedObject(...args),
}));
jest.mock('../ExpoGoogleMobileAdsModule', () => ({
  __esModule: true,
  default: { InterstitialAd: jest.fn() },
}));
jest.mock('../initialization', () => ({ runWhenInitialized: jest.fn() }));

import { renderHook } from '@testing-library/react-native';

import { useInterstitialAd, useInterstitialAdState } from './useInterstitialAd';

function makeAd(status = 'loading', error?: unknown) {
  return { status, error, load: jest.fn(), showAsync: jest.fn() } as any;
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
