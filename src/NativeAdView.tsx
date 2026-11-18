import { requireNativeViewManager } from 'expo-modules-core';
import type { StyleProp, ViewStyle } from 'react-native';

import { isFullScreenAdReleased } from './FullScreenAd';
import type { NativeAd } from './NativeAd';
import { useNativeAdState } from './hooks/useNativeAd';

const NativeView = requireNativeViewManager('ExpoGoogleMobileAdsObjects', 'NativeAdView');
export type NativeAdViewProps = { ad: NativeAd; style?: StyleProp<ViewStyle> };

/** A native card with attribution, SDK media, headline, icon, body, advertiser and CTA. */
export function NativeAdView({ ad, style }: NativeAdViewProps) {
  useNativeAdState(ad);
  const released = isFullScreenAdReleased(ad);
  // Pass an ID so React Native DEV prop freezing cannot freeze the SharedObject.
  // @ts-expect-error internal registry ID installed by Expo
  const id = released ? null : ad.__expo_shared_object_id__;
  return (
    <NativeView
      ad={typeof id === 'number' && id > 0 ? id : null}
      style={[{ height: 360 }, style]}
    />
  );
}
