import { useEventListener } from 'expo';
import { useReleasingSharedObject } from 'expo-modules-core';
import { useState } from 'react';

import { NativeObjects } from '../ExpoGoogleMobileAdsModule';
import { isFullScreenAdReleased, loadFullScreenAdWhenInitialized } from '../FullScreenAd';
import type { FullScreenAdOptions } from '../FullScreenAd';
import { attachShow } from '../RewardedInterstitialAd';
import type {
  NativeRewardedInterstitialAd,
  RewardedInterstitialAd,
} from '../RewardedInterstitialAd';
import type { AdError } from '../types';
import type { FullScreenAdState } from './useInterstitialAd';

function readState(ad: { status?: string; error?: AdError }): FullScreenAdState {
  if (isFullScreenAdReleased(ad as never)) {
    return { isLoaded: false };
  }
  return { isLoaded: ad.status === 'loaded', error: ad.error };
}

export function useRewardedInterstitialAdState(ad: RewardedInterstitialAd): FullScreenAdState {
  const [state, setState] = useState(() => readState(ad));
  const [stateOwner, setStateOwner] = useState(ad);

  if (stateOwner !== ad) {
    setStateOwner(ad);
    setState(readState(ad));
  }

  useEventListener(ad, 'statusChange', () => setState(readState(ad)));

  return state;
}

export function useRewardedInterstitialAd(
  options: FullScreenAdOptions
): FullScreenAdState & { ad: RewardedInterstitialAd } {
  const ad = useReleasingSharedObject<RewardedInterstitialAd>(() => {
    const created: NativeRewardedInterstitialAd = new NativeObjects.RewardedInterstitialAd(
      options.adUnitId,
      options.requestOptions
    );
    loadFullScreenAdWhenInitialized(created);
    return attachShow(created);
  }, [options.adUnitId]);

  return { ...useRewardedInterstitialAdState(ad), ad };
}
