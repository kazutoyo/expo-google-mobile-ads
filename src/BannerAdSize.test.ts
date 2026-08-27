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

  it('returns the size native returns, marked with the kind it was built for', () => {
    expect(BannerAdSize.anchoredAdaptive()).toEqual({
      width: 360,
      height: 50,
      adaptiveKind: 'anchored',
    });
  });
});

describe('largeAnchoredAdaptive', () => {
  it('calls the native function for the large variant', () => {
    BannerAdSize.largeAnchoredAdaptive({ width: 360 });
    expect(mockNative.getLargeAnchoredAdaptiveSize).toHaveBeenCalledWith(360, 'current');
    expect(mockNative.getAnchoredAdaptiveSize).not.toHaveBeenCalled();
  });
});

// The marker has to name the exact factory the size came from, orientation included: both SDKs'
// anchored factories are per-orientation and return a different height for the same width, so
// rebuilding an explicitly portrait size through the current-orientation factory on a landscape
// device would silently retarget the request.
describe('the adaptive marker', () => {
  it.each([
    ['anchoredAdaptive', 'current', 'anchored'],
    ['anchoredAdaptive', 'portrait', 'anchoredPortrait'],
    ['anchoredAdaptive', 'landscape', 'anchoredLandscape'],
    ['largeAnchoredAdaptive', 'current', 'largeAnchored'],
    ['largeAnchoredAdaptive', 'portrait', 'largeAnchoredPortrait'],
    ['largeAnchoredAdaptive', 'landscape', 'largeAnchoredLandscape'],
  ] as const)('%s in %s orientation is marked %s', (helper, orientation, expected) => {
    expect(BannerAdSize[helper]({ orientation }).adaptiveKind).toBe(expected);
  });

  it('matches the orientation actually passed to native', () => {
    const size = BannerAdSize.anchoredAdaptive({ orientation: 'landscape' });
    expect(mockNative.getAnchoredAdaptiveSize).toHaveBeenCalledWith(390, 'landscape');
    expect(size.adaptiveKind).toBe('anchoredLandscape');
  });
});

describe('inlineAdaptive', () => {
  it('passes the width and maxHeight through', () => {
    BannerAdSize.inlineAdaptive({ width: 360, maxHeight: 200 });
    expect(mockNative.getInlineAdaptiveSize).toHaveBeenCalledWith(360, 200);
  });

  it('uses the screen width when width is omitted', () => {
    BannerAdSize.inlineAdaptive({ maxHeight: 200 });
    expect(mockNative.getInlineAdaptiveSize).toHaveBeenCalledWith(390, 200);
  });

  // Without this marker the native side rebuilds a *fixed* banner of exactly `height`, which is
  // what made an inline adaptive request stop being adaptive.
  it('marks the size as inline adaptive', () => {
    expect(BannerAdSize.inlineAdaptive({ width: 360, maxHeight: 200 })).toEqual({
      width: 360,
      height: 120,
      adaptiveKind: 'inline',
    });
  });

  it('leaves the fixed sizes unmarked', () => {
    expect(BannerAdSize.BANNER.adaptiveKind).toBeUndefined();
    expect(BannerAdSize.LEADERBOARD.adaptiveKind).toBeUndefined();
  });
});

describe('resolve', () => {
  it('dispatches based on type', () => {
    BannerAdSize.resolve({ type: 'largeAnchoredAdaptive', width: 360 });
    expect(mockNative.getLargeAnchoredAdaptiveSize).toHaveBeenCalledWith(360, 'current');

    BannerAdSize.resolve({ type: 'inlineAdaptive', width: 360, maxHeight: 200 });
    expect(mockNative.getInlineAdaptiveSize).toHaveBeenCalledWith(360, 200);
  });
});
