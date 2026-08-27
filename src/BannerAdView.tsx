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
 * Hands the shared object's registry id to native instead of the object itself.
 *
 * In `__DEV__`, React Native deep-freezes every prop value it gives to a native view
 * (`ReactFabric-dev.js` -> `deepFreezeAndThrowOnMutationInDev`, which calls
 * `Object.freeze` + `Object.seal`). A frozen `SharedObject` can no longer have its internal
 * native-state property re-defined, so a later `ad.release()` throws
 * "Exception in HostFunction: failed to define internal native state property" from Hermes
 * and crashes the app. `useBannerAd` releases the old ad whenever `adUnitId` or `size`
 * changes, so an ordinary device rotation used to crash.
 *
 * A number cannot be frozen, so passing the id keeps `release()` working. Native still
 * receives a `BannerAd` — expo-modules-core converts the id back through the shared object
 * registry. `expo-video` passes `player.__expo_shared_object_id__` to `VideoView` the same way.
 */
function sharedObjectIdOf(ad: BannerAd): number {
  // @ts-expect-error internal property installed by expo-modules-core on every SharedObject
  return ad.__expo_shared_object_id__;
}

/**
 * 広告を表示する。マウント時にネイティブ View をアタッチし、アンマウント時はデタッチのみ行う。
 * 広告は破棄されないため、画面遷移をまたいで再利用できる。
 */
export function BannerAdView({ ad, style }: BannerAdViewProps) {
  const size = ad.loadedSize ?? ad.size;

  return (
    <NativeView
      ad={sharedObjectIdOf(ad)}
      style={[{ width: size.width, height: size.height }, style]}
    />
  );
}
