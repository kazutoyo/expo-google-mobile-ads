import { Dimensions } from 'react-native';

import NativeModule from './ExpoGoogleMobileAdsModule';

export type BannerAdSize = {
  readonly width: number;
  readonly height: number;
  /**
   * Set by `inlineAdaptive()`; `height` is then the maximum height rather than a fixed one.
   *
   * Both SDKs represent "inline adaptive" as a flag on their ad-size type
   * (`GADAdSize.flags` on iOS, `AdSize.isInlineAdaptiveBanner` on Android), not as a
   * width/height value, so it cannot be derived from the two numbers alone. Without this
   * marker the native side rebuilds the size with `GADAdSizeFromCGSize` / `AdSize(w, h)`,
   * which produce a *fixed* banner of exactly `height` — the request stops being adaptive.
   */
  readonly inlineAdaptive?: boolean;
};

export type AdaptiveOptions = {
  /** In dp. Defaults to the screen width. */
  width?: number;
  /** Defaults to 'current' (the orientation at call time). */
  orientation?: 'current' | 'portrait' | 'landscape';
};

export type InlineAdaptiveOptions = {
  /** In dp. Defaults to the screen width. */
  width?: number;
  /**
   * Maximum height in dp. Must be at least 32dp; 50dp or more is recommended.
   *
   * Required — see `inlineAdaptive()` for why there is no meaningful default.
   */
  maxHeight: number;
};

export type BannerAdSizeSpec =
  | ({ type: 'anchoredAdaptive' } & AdaptiveOptions)
  | ({ type: 'largeAnchoredAdaptive' } & AdaptiveOptions)
  | ({ type: 'inlineAdaptive' } & InlineAdaptiveOptions);

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

  /**
   * Size for an inline adaptive banner meant to sit inside scrolling content. The returned
   * `height` is the maximum; the served ad may be shorter, and `ad.loadedSize` reports what
   * actually arrived.
   *
   * `maxHeight` is required, and there is deliberately no default. The SDKs' "no max height"
   * helpers are not representable as the concrete `{ width, height }` this type promises:
   * iOS's `GADPortraitInlineAdaptiveBannerAdSizeWithWidth` returns height `0` as a sentinel and
   * keeps the real bound in `GADAdSize.flags`, while Android's
   * `getCurrentOrientationInlineAdaptiveBannerAdSize` returns the whole screen height (923dp on
   * a Pixel 9a) — neither is a height a caller can reserve space for. Any default this function
   * picked instead would be an arbitrary layout reservation the caller never asked for.
   *
   * There is no `orientation` option: unlike the anchored helpers, the max-height form of the
   * inline adaptive size is orientation-independent on both platforms.
   */
  inlineAdaptive(options: InlineAdaptiveOptions): BannerAdSize {
    const size = NativeModule.getInlineAdaptiveSize(
      options.width ?? screenWidth(),
      options.maxHeight
    );
    // Tag it here rather than in each native module: it is the same constant on both platforms.
    return { ...size, inlineAdaptive: true };
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
