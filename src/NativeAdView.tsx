import { requireNativeViewManager } from 'expo-modules-core';
import type { StyleProp, ViewStyle } from 'react-native';

import { isFullScreenAdReleased } from './FullScreenAd';
import type { NativeAd } from './NativeAd';
import { useNativeAdState } from './hooks/useNativeAd';

const NativeView = requireNativeViewManager('ExpoGoogleMobileAdsObjects', 'NativeAdView');
export type NativeAdViewLayout = 'card' | 'fullScreen';
export type NativeAdViewProps = {
  ad: NativeAd;
  /**
   * `card` (default): a card with attribution, SDK media, headline, icon, body, advertiser and CTA.
   * `fullScreen`: SDK media fills the view, with an install card (icon, headline, body, CTA) at the bottom.
   */
  layout?: NativeAdViewLayout;
  /** `fullScreen` only: points/dp at the bottom kept clear for app UI drawn over the view. */
  bottomInset?: number;
  style?: StyleProp<ViewStyle>;
};

/** A native ad rendered with a built-in layout. */
export function NativeAdView({ ad, layout = 'card', bottomInset = 0, style }: NativeAdViewProps) {
  useNativeAdState(ad);
  const released = isFullScreenAdReleased(ad);
  // Pass an ID so React Native DEV prop freezing cannot freeze the SharedObject.
  // @ts-expect-error internal registry ID installed by Expo
  const id = released ? null : ad.__expo_shared_object_id__;
  return (
    <NativeView
      ad={typeof id === 'number' && id > 0 ? id : null}
      layout={layout}
      bottomInset={bottomInset}
      style={[{ height: 360 }, style]}
    />
  );
}
