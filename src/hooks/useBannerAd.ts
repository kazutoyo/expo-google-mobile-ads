import { useEvent } from 'expo';
import { useReleasingSharedObject } from 'expo-modules-core';

import type { BannerAd, BannerAdOptions } from '../BannerAd';
import type { BannerAdSize } from '../BannerAdSize';
import NativeModule from '../ExpoGoogleMobileAdsModule';
import { runWhenInitialized } from '../initialization';
import type { AdError } from '../types';

export type BannerAdState = {
  isLoaded: boolean;
  error?: AdError;
  loadedSize?: BannerAdSize;
};

/**
 * Subscribes to an ad that already exists (e.g. one preloaded outside a View with
 * `createBannerAd`).
 *
 * Does not create or release the ad — the caller is responsible for its lifetime.
 */
export function useBannerAdState(ad: BannerAd): BannerAdState {
  const { status, error } = useEvent(ad, 'statusChange', {
    status: ad.status,
    error: ad.error,
  });

  return {
    isLoaded: status === 'loaded',
    error,
    loadedSize: ad.loadedSize,
  };
}

/**
 * Creates a banner ad and automatically releases it on unmount. Same design as
 * `useVideoPlayer`.
 *
 * `requestOptions` is only read at creation time; changing it afterward has no effect
 * (it's excluded from the dependency array because it tends to be a new object
 * reference on every render). To use different requestOptions, call this hook again
 * to create a new ad.
 */
export function useBannerAd(options: BannerAdOptions): BannerAdState & { ad: BannerAd } {
  const ad = useReleasingSharedObject<BannerAd>(() => {
    const created: BannerAd = new NativeModule.BannerAd(
      options.adUnitId,
      options.size,
      options.requestOptions
    );
    runWhenInitialized(() => created.load());
    return created;
  }, [options.adUnitId, options.size.width, options.size.height]);

  return { ...useBannerAdState(ad), ad };
}
