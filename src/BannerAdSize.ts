import { Dimensions } from 'react-native';

import NativeModule from './ExpoGoogleMobileAdsModule';

export type BannerAdSize = {
  readonly width: number;
  readonly height: number;
};

export type AdaptiveOptions = {
  /** dp。省略時は画面幅 */
  width?: number;
  /** 既定は 'current'（呼んだ瞬間の向き） */
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
   * アンカー型アダプティブバナーのサイズ。高さは 50〜90dp。
   *
   * 対応するネイティブ API は非推奨であり、将来の SDK メジャーで削除される可能性がある。
   * 新規実装では largeAnchoredAdaptive を検討すること。
   */
  anchoredAdaptive(options: AdaptiveOptions = {}): BannerAdSize {
    return NativeModule.getAnchoredAdaptiveSize(
      options.width ?? screenWidth(),
      options.orientation ?? 'current'
    );
  },

  /** アンカー型アダプティブバナー Large のサイズ。高さは 50〜150dp。 */
  largeAnchoredAdaptive(options: AdaptiveOptions = {}): BannerAdSize {
    return NativeModule.getLargeAnchoredAdaptiveSize(
      options.width ?? screenWidth(),
      options.orientation ?? 'current'
    );
  },

  /** スクロール内に置くインライン型アダプティブバナーのサイズ。 */
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
