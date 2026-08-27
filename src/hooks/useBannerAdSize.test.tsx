import { renderHook } from '@testing-library/react-native';

import NativeModule from '../ExpoGoogleMobileAdsModule';
import { BannerAdSize } from '../BannerAdSize';
import { useBannerAdSize } from './useBannerAdSize';

jest.mock('../ExpoGoogleMobileAdsModule', () => ({
  __esModule: true,
  default: {
    getLargeAnchoredAdaptiveSize: jest.fn(() => ({ width: 390, height: 100 })),
    getAnchoredAdaptiveSize: jest.fn(() => ({ width: 390, height: 50 })),
    getInlineAdaptiveSize: jest.fn(() => ({ width: 390, height: 120 })),
  },
}));

const mockUseWindowDimensions = jest.fn(() => ({ width: 390, height: 844 }));
jest.mock('react-native', () => ({
  Dimensions: { get: () => ({ width: 390, height: 844 }) },
  useWindowDimensions: () => mockUseWindowDimensions(),
}));

const mockNative = NativeModule as jest.Mocked<typeof NativeModule>;

beforeEach(() => jest.clearAllMocks());

describe('useBannerAdSize', () => {
  it('spec に応じたサイズを返す', async () => {
    const { result } = await renderHook(() => useBannerAdSize({ type: 'largeAnchoredAdaptive' }));

    expect(result.current).toEqual({ width: 390, height: 100 });
  });

  it('画面幅が変わると再計算する', async () => {
    const { rerender } = await renderHook(() => useBannerAdSize({ type: 'largeAnchoredAdaptive' }));

    expect(mockNative.getLargeAnchoredAdaptiveSize).toHaveBeenCalledTimes(1);

    mockUseWindowDimensions.mockReturnValue({ width: 844, height: 390 });
    await rerender({});

    expect(mockNative.getLargeAnchoredAdaptiveSize).toHaveBeenCalledTimes(2);
  });

  it('ネイティブが失敗した場合は直前のサイズにフォールバックする（レンダーをクラッシュさせない）', async () => {
    mockUseWindowDimensions.mockReturnValue({ width: 390, height: 844 });
    const { result, rerender } = await renderHook(() =>
      useBannerAdSize({ type: 'largeAnchoredAdaptive' })
    );
    expect(result.current).toEqual({ width: 390, height: 100 });

    mockNative.getLargeAnchoredAdaptiveSize.mockImplementationOnce(() => {
      throw new Error('ERR_UI_THREAD_UNRESPONSIVE');
    });
    mockUseWindowDimensions.mockReturnValue({ width: 844, height: 390 });
    await rerender({});

    // 直前に成功したサイズのまま — 例外がフックの外に漏れない。
    expect(result.current).toEqual({ width: 390, height: 100 });
  });

  it('一度も成功していない場合は既定値 BannerAdSize.BANNER にフォールバックする', async () => {
    mockNative.getLargeAnchoredAdaptiveSize.mockImplementationOnce(() => {
      throw new Error('ERR_UI_THREAD_UNRESPONSIVE');
    });

    const { result } = await renderHook(() => useBannerAdSize({ type: 'largeAnchoredAdaptive' }));

    expect(result.current).toEqual(BannerAdSize.BANNER);
  });
});
