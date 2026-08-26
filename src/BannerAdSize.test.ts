jest.mock('./ExpoGoogleMobileAdsModule', () => ({
  __esModule: true,
  default: {
    getAnchoredAdaptiveSize: jest.fn(() => ({ width: 360, height: 50 })),
    getLargeAnchoredAdaptiveSize: jest.fn(() => ({ width: 360, height: 100 })),
    getInlineAdaptiveSize: jest.fn(() => ({ width: 360, height: 120 })),
  },
}));

jest.mock('react-native', () => ({
  Dimensions: { get: () => ({ width: 390, height: 844 }) },
}));

import NativeModule from './ExpoGoogleMobileAdsModule';
import { BannerAdSize } from './BannerAdSize';

const mockNative = NativeModule as jest.Mocked<typeof NativeModule>;

beforeEach(() => jest.clearAllMocks());

describe('固定サイズ', () => {
  it('MMA バナーは 320x50', () => {
    expect(BannerAdSize.BANNER).toEqual({ width: 320, height: 50 });
  });

  it('ミディアムレクタングルは 300x250', () => {
    expect(BannerAdSize.MEDIUM_RECTANGLE).toEqual({ width: 300, height: 250 });
  });
});

describe('anchoredAdaptive', () => {
  it('width 省略時は画面幅を使う', () => {
    BannerAdSize.anchoredAdaptive();
    expect(mockNative.getAnchoredAdaptiveSize).toHaveBeenCalledWith(390, 'current');
  });

  it('width と orientation を指定できる', () => {
    BannerAdSize.anchoredAdaptive({ width: 360, orientation: 'portrait' });
    expect(mockNative.getAnchoredAdaptiveSize).toHaveBeenCalledWith(360, 'portrait');
  });

  it('ネイティブが返したサイズをそのまま返す', () => {
    expect(BannerAdSize.anchoredAdaptive()).toEqual({ width: 360, height: 50 });
  });
});

describe('largeAnchoredAdaptive', () => {
  it('large 用のネイティブ関数を呼ぶ', () => {
    BannerAdSize.largeAnchoredAdaptive({ width: 360 });
    expect(mockNative.getLargeAnchoredAdaptiveSize).toHaveBeenCalledWith(360, 'current');
    expect(mockNative.getAnchoredAdaptiveSize).not.toHaveBeenCalled();
  });
});

describe('inlineAdaptive', () => {
  it('maxHeight 省略時は null を渡す', () => {
    BannerAdSize.inlineAdaptive({ width: 360 });
    expect(mockNative.getInlineAdaptiveSize).toHaveBeenCalledWith(360, null, 'current');
  });

  it('maxHeight を指定できる', () => {
    BannerAdSize.inlineAdaptive({ width: 360, maxHeight: 200 });
    expect(mockNative.getInlineAdaptiveSize).toHaveBeenCalledWith(360, 200, 'current');
  });
});

describe('resolve', () => {
  it('type に応じて振り分ける', () => {
    BannerAdSize.resolve({ type: 'largeAnchoredAdaptive', width: 360 });
    expect(mockNative.getLargeAnchoredAdaptiveSize).toHaveBeenCalledWith(360, 'current');

    BannerAdSize.resolve({ type: 'inlineAdaptive', width: 360, maxHeight: 200 });
    expect(mockNative.getInlineAdaptiveSize).toHaveBeenCalledWith(360, 200, 'current');
  });
});
