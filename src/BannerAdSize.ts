import { Dimensions } from 'react-native';

import NativeModule from './ExpoGoogleMobileAdsModule';

export type BannerAdSize = {
  readonly width: number;
  readonly height: number;
};

export type AdaptiveOptions = {
  /** In dp. Defaults to the screen width. */
  width?: number;
  /** Defaults to 'current' (the orientation at call time). */
  orientation?: 'current' | 'portrait' | 'landscape';
};

export type BannerAdSizeSpec =
  | ({ type: 'anchoredAdaptive' } & AdaptiveOptions)
  | ({ type: 'largeAnchoredAdaptive' } & AdaptiveOptions)
  | ({ type: 'inlineAdaptive'; maxHeight?: number } & AdaptiveOptions);

function screenWidth(): number {
  return Dimensions.get('window').width;
}

export const BannerAdSize = {
  BANNER: { width: 320, height: 50 } as BannerAdSize,
  LARGE_BANNER: { width: 320, height: 100 } as BannerAdSize,
  MEDIUM_RECTANGLE: { width: 300, height: 250 } as BannerAdSize,
  FULL_BANNER: { width: 468, height: 60 } as BannerAdSize,
  LEADERBOARD: { width: 728, height: 90 } as BannerAdSize,

  /**
   * Size for an anchored adaptive banner. Height ranges from 50 to 90dp.
   *
   * The underlying native API is deprecated and may be removed in a future SDK major
   * version. Prefer largeAnchoredAdaptive for new implementations.
   *
   * This function deliberately carries no `@deprecated` tag. Large anchored adaptive
   * banners are considerably taller (50-150dp against 50-90dp here), so choosing this
   * one to fit a tighter layout is a legitimate decision, not an oversight — and an
   * editor warning on every call site would only get in the way of callers who meant it.
   * When the native API is eventually removed, delete this function outright; keeping it
   * under a separate name from largeAnchoredAdaptive is what makes that a clean removal.
   */
  anchoredAdaptive(options: AdaptiveOptions = {}): BannerAdSize {
    return NativeModule.getAnchoredAdaptiveSize(
      options.width ?? screenWidth(),
      options.orientation ?? 'current'
    );
  },

  /** Size for a large anchored adaptive banner. Height ranges from 50 to 150dp. */
  largeAnchoredAdaptive(options: AdaptiveOptions = {}): BannerAdSize {
    return NativeModule.getLargeAnchoredAdaptiveSize(
      options.width ?? screenWidth(),
      options.orientation ?? 'current'
    );
  },

  /** Size for an inline adaptive banner meant to sit inside scrolling content. */
  inlineAdaptive(options: AdaptiveOptions & { maxHeight?: number } = {}): BannerAdSize {
    return NativeModule.getInlineAdaptiveSize(
      options.width ?? screenWidth(),
      options.maxHeight ?? null,
      options.orientation ?? 'current'
    );
  },

  resolve(spec: BannerAdSizeSpec): BannerAdSize {
    switch (spec.type) {
      case 'anchoredAdaptive':
        return BannerAdSize.anchoredAdaptive(spec);
      case 'largeAnchoredAdaptive':
        return BannerAdSize.largeAnchoredAdaptive(spec);
      case 'inlineAdaptive':
        return BannerAdSize.inlineAdaptive(spec);
    }
  },
};
