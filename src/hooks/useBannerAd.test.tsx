import { renderHook } from '@testing-library/react-native';

import { useBannerAd, useBannerAdState } from './useBannerAd';

const mockUseEvent = jest.fn();
const mockUseReleasingSharedObject = jest.fn();

jest.mock('expo', () => ({ useEvent: (...args: any[]) => mockUseEvent(...args) }));
jest.mock('expo-modules-core', () => ({
  useReleasingSharedObject: (...args: any[]) => mockUseReleasingSharedObject(...args),
}));
jest.mock('../ExpoGoogleMobileAdsModule', () => ({
  __esModule: true,
  default: { BannerAd: jest.fn() },
}));
jest.mock('../initialization', () => ({ runWhenInitialized: jest.fn() }));

const size = { width: 360, height: 50 };

function makeAd(overrides: any = {}) {
  return { status: 'loading', load: jest.fn(), ...overrides } as any;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseEvent.mockReturnValue({ status: 'loading' });
});

describe('useBannerAdState', () => {
  it('subscribes to the passed ad\'s statusChange', async () => {
    const ad = makeAd({ status: 'loading' });

    await renderHook(() => useBannerAdState(ad));

    expect(mockUseEvent).toHaveBeenCalledWith(ad, 'statusChange', {
      status: 'loading',
      error: undefined,
    });
  });

  it('isLoaded is true when loaded', async () => {
    mockUseEvent.mockReturnValue({ status: 'loaded' });
    const ad = makeAd({ loadedSize: size });

    const { result } = await renderHook(() => useBannerAdState(ad));

    expect(result.current.isLoaded).toBe(true);
    expect(result.current.loadedSize).toEqual(size);
  });

  it('isLoaded is false and returns the error on error', async () => {
    const error = { code: 3, message: 'No fill', domain: 'com.google.admob' };
    mockUseEvent.mockReturnValue({ status: 'error', error });

    const { result } = await renderHook(() => useBannerAdState(makeAd()));

    expect(result.current.isLoaded).toBe(false);
    expect(result.current.error).toBe(error);
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

  it('includes adUnitId and size in the dependency array', async () => {
    mockUseReleasingSharedObject.mockReturnValue(makeAd());

    await renderHook(() => useBannerAd({ adUnitId: 'unit', size }));

    expect(mockUseReleasingSharedObject.mock.calls[0][1]).toEqual(['unit', 360, 50]);
  });
});
