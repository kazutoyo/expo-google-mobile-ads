import { renderHook } from '@testing-library/react-native';

import { useBannerAd } from './useBannerAd';

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

describe('useBannerAd(ad)', () => {
  it('渡された ad の statusChange を購読する', async () => {
    const ad = makeAd({ status: 'loading' });

    await renderHook(() => useBannerAd(ad));

    expect(mockUseEvent).toHaveBeenCalledWith(ad, 'statusChange', {
      status: 'loading',
      error: undefined,
    });
  });

  it('loaded なら isLoaded が true', async () => {
    mockUseEvent.mockReturnValue({ status: 'loaded' });
    const ad = makeAd({ loadedSize: size });

    const { result } = await renderHook(() => useBannerAd(ad));

    expect(result.current.isLoaded).toBe(true);
    expect(result.current.loadedSize).toEqual(size);
  });

  it('error なら isLoaded が false でエラーを返す', async () => {
    const error = { code: 3, message: 'No fill', domain: 'com.google.admob' };
    mockUseEvent.mockReturnValue({ status: 'error', error });

    const { result } = await renderHook(() => useBannerAd(makeAd()));

    expect(result.current.isLoaded).toBe(false);
    expect(result.current.error).toBe(error);
  });

  it('ad を渡した場合は ad を生成しない', async () => {
    await renderHook(() => useBannerAd(makeAd()));

    expect(mockUseReleasingSharedObject).not.toHaveBeenCalled();
  });
});

describe('useBannerAd(options)', () => {
  it('useReleasingSharedObject で ad を生成し返す', async () => {
    const ad = makeAd();
    mockUseReleasingSharedObject.mockReturnValue(ad);

    const { result } = await renderHook(() => useBannerAd({ adUnitId: 'unit', size }));

    expect(mockUseReleasingSharedObject).toHaveBeenCalledTimes(1);
    expect(result.current.ad).toBe(ad);
  });

  it('adUnitId とサイズが依存配列に入る', async () => {
    mockUseReleasingSharedObject.mockReturnValue(makeAd());

    await renderHook(() => useBannerAd({ adUnitId: 'unit', size }));

    expect(mockUseReleasingSharedObject.mock.calls[0][1]).toEqual(['unit', 360, 50]);
  });
});
