import { requireNativeViewManager } from 'expo-modules-core';
import type { StyleProp, ViewStyle } from 'react-native';

import { isReleased, sharedObjectIdOf, type BannerAd } from './BannerAd';
import { useBannerAdState } from './hooks/useBannerAd';

const NativeView = requireNativeViewManager('ExpoGoogleMobileAds', 'BannerAdView');

export type BannerAdViewProps = {
  /** An ad created by createBannerAd or useBannerAd. Safe to pass before it has loaded. */
  ad: BannerAd;
  style?: StyleProp<ViewStyle>;
};

/** The box a released ad gets: nothing left to show, so it takes up no space. */
const RELEASED_SIZE = { width: 0, height: 0 };

/**
 * Displays an ad. Attaches the native view on mount and only detaches it on unmount —
 * the ad itself is never destroyed, so it can be reused across screen transitions.
 *
 * Subscribes to the ad itself rather than trusting the parent to re-render. A preloaded ad is
 * routinely rendered with no `useBannerAdState` anywhere (that is exactly what the README's
 * preload example does), and then nothing would re-render when the ad finishes loading, so the
 * requested size would stick even when the served ad came back a different size.
 */
export function BannerAdView({ ad, style }: BannerAdViewProps) {
  const { loadedSize } = useBannerAdState(ad);
  // Callers can legitimately still be rendering an ad they just released. Reading `ad.size`
  // would then throw, and handing native an id whose registry entry is gone throws the same
  // exception during prop application, so a released ad gets no id and no space at all.
  const released = isReleased(ad);
  const sharedObjectId = released ? null : sharedObjectIdOf(ad);
  const size = released ? RELEASED_SIZE : (loadedSize ?? ad.size);

  return (
    <NativeView ad={sharedObjectId} style={[{ width: size.width, height: size.height }, style]} />
  );
}
