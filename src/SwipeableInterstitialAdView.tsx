import { requireNativeViewManager } from 'expo-modules-core';
import type { StyleProp, ViewStyle } from 'react-native';

import { isReleased, sharedObjectIdOf } from './BannerAd';
import type { SwipeableInterstitialAd } from './SwipeableInterstitialAd';
import { useSwipeableInterstitialAdState } from './hooks/useSwipeableInterstitialAd';

const NativeView = requireNativeViewManager(
  'ExpoGoogleMobileAdsObjects',
  'SwipeableInterstitialAdView'
);

export type SwipeableInterstitialAdViewProps = {
  ad: SwipeableInterstitialAd;
  /** Give the view full screen dimensions, or the dimensions requested with options.size. */
  style?: StyleProp<ViewStyle>;
};

/**
 * Embeds an ad in your own full screen or paged feed. Unmounting detaches the view;
 * the owner releases the ad. Mount each ad in only one view at a time.
 * The app must enforce minScreenHoldDuration if a nonzero maximum hold time was requested.
 */
export function SwipeableInterstitialAdView({ ad, style }: SwipeableInterstitialAdViewProps) {
  const { isLoaded } = useSwipeableInterstitialAdState(ad);
  const id = isLoaded && !isReleased(ad) ? sharedObjectIdOf(ad) : null;
  return <NativeView ad={id} style={style} />;
}
