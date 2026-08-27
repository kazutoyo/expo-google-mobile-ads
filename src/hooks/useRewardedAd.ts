import { useEventListener } from 'expo';
import { useReleasingSharedObject } from 'expo-modules-core';
import { useState } from 'react';

import NativeModule from '../ExpoGoogleMobileAdsModule';
import { isFullScreenAdReleased, loadFullScreenAdWhenInitialized } from '../FullScreenAd';
import type { FullScreenAdOptions } from '../FullScreenAd';
import { attachShow } from '../RewardedAd';
import type { NativeRewardedAd, RewardedAd } from '../RewardedAd';
import type { AdError } from '../types';
import type { FullScreenAdState } from './useInterstitialAd';

function readState(ad: { status?: string; error?: AdError }): FullScreenAdState {
  if (isFullScreenAdReleased(ad as never)) {
    return { isLoaded: false };
  }
  return { isLoaded: ad.status === 'loaded', error: ad.error };
}

/**
 * Subscribes to a rewarded ad the caller already owns. Does not create or release it.
 *
 * Reports load state only. The reward the ad offers stays on `ad.reward`, and whether the
 * user actually earned it comes solely from `show()`'s resolved value — keeping those apart
 * is what stops a caller from granting a reward nobody earned.
 *
 * The state is keyed on the ad instance, for the same reason as `useInterstitialAdState`:
 * `useEvent`'s `initialValue` is only `useState`'s initial argument, so state from a previous
 * ad would otherwise carry over.
 */
export function useRewardedAdState(ad: RewardedAd): FullScreenAdState {
  const [state, setState] = useState(() => readState(ad));
  const [stateOwner, setStateOwner] = useState(ad);

  if (stateOwner !== ad) {
    setStateOwner(ad);
    setState(readState(ad));
  }

  useEventListener(ad, 'statusChange', () => setState(readState(ad)));

  return state;
}

/**
 * Creates a rewarded ad and releases it on unmount.
 *
 * `requestOptions` is only read at creation time; changing it later has no effect. Call the
 * hook again with a different `adUnitId` to get a new ad.
 */
export function useRewardedAd(
  options: FullScreenAdOptions
): FullScreenAdState & { ad: RewardedAd } {
  const ad = useReleasingSharedObject<RewardedAd>(() => {
    const created: NativeRewardedAd = new NativeModule.RewardedAd(
      options.adUnitId,
      options.requestOptions
    );
    loadFullScreenAdWhenInitialized(created);
    return attachShow(created);
  }, [options.adUnitId]);

  return { ...useRewardedAdState(ad), ad };
}
