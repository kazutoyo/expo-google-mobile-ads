import { requireNativeViewManager } from 'expo-modules-core';
import type { StyleProp, ViewStyle } from 'react-native';

import type { BannerAd } from './BannerAd';

const NativeView = requireNativeViewManager('ExpoGoogleMobileAds', 'BannerAdView');

export type BannerAdViewProps = {
  /** createBannerAd または useBannerAd で作った広告。未ロードでも渡してよい。 */
  ad: BannerAd;
  style?: StyleProp<ViewStyle>;
};

/**
 * 広告を表示する。マウント時にネイティブ View をアタッチし、アンマウント時はデタッチのみ行う。
 * 広告は破棄されないため、画面遷移をまたいで再利用できる。
 */
export function BannerAdView({ ad, style }: BannerAdViewProps) {
  const size = ad.loadedSize ?? ad.size;

  return <NativeView ad={ad} style={[{ width: size.width, height: size.height }, style]} />;
}
