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

describe('fixed sizes', () => {
  it('BANNER is 320x50', () => {
    expect(BannerAdSize.BANNER).toEqual({ width: 320, height: 50 });
  });

  it('MEDIUM_RECTANGLE is 300x250', () => {
    expect(BannerAdSize.MEDIUM_RECTANGLE).toEqual({ width: 300, height: 250 });
  });
});

describe('anchoredAdaptive', () => {
  it('uses the screen width when width is omitted', () => {
    BannerAdSize.anchoredAdaptive();
    expect(mockNative.getAnchoredAdaptiveSize).toHaveBeenCalledWith(390, 'current');
  });

  it('accepts width and orientation', () => {
    BannerAdSize.anchoredAdaptive({ width: 360, orientation: 'portrait' });
    expect(mockNative.getAnchoredAdaptiveSize).toHaveBeenCalledWith(360, 'portrait');
  });

  it('returns whatever size native returns, unchanged', () => {
    expect(BannerAdSize.anchoredAdaptive()).toEqual({ width: 360, height: 50 });
  });
});

describe('largeAnchoredAdaptive', () => {
  it('calls the native function for the large variant', () => {
    BannerAdSize.largeAnchoredAdaptive({ width: 360 });
    expect(mockNative.getLargeAnchoredAdaptiveSize).toHaveBeenCalledWith(360, 'current');
    expect(mockNative.getAnchoredAdaptiveSize).not.toHaveBeenCalled();
  });
});

describe('inlineAdaptive', () => {
  it('passes null when maxHeight is omitted', () => {
    BannerAdSize.inlineAdaptive({ width: 360 });
    expect(mockNative.getInlineAdaptiveSize).toHaveBeenCalledWith(360, null, 'current');
  });

  it('accepts maxHeight', () => {
    BannerAdSize.inlineAdaptive({ width: 360, maxHeight: 200 });
    expect(mockNative.getInlineAdaptiveSize).toHaveBeenCalledWith(360, 200, 'current');
  });
});

describe('resolve', () => {
  it('dispatches based on type', () => {
    BannerAdSize.resolve({ type: 'largeAnchoredAdaptive', width: 360 });
    expect(mockNative.getLargeAnchoredAdaptiveSize).toHaveBeenCalledWith(360, 'current');

    BannerAdSize.resolve({ type: 'inlineAdaptive', width: 360, maxHeight: 200 });
    expect(mockNative.getInlineAdaptiveSize).toHaveBeenCalledWith(360, 200, 'current');
  });
});
