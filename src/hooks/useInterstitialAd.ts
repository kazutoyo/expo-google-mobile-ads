import { useEventListener } from 'expo';
import { useReleasingSharedObject } from 'expo-modules-core';
import { useState } from 'react';

import NativeModule from '../ExpoGoogleMobileAdsModule';
import { isFullScreenAdReleased, loadFullScreenAdWhenInitialized } from '../FullScreenAd';
import type { FullScreenAdOptions } from '../FullScreenAd';
import { attachShow } from '../InterstitialAd';
import type { InterstitialAd, NativeInterstitialAd } from '../InterstitialAd';
import type { AdError } from '../types';

export type FullScreenAdState = {
  isLoaded: boolean;
  error?: AdError;
};

function readState(ad: { status?: string; error?: AdError }): FullScreenAdState {
  if (isFullScreenAdReleased(ad as never)) {
    return { isLoaded: false };
  }
  return { isLoaded: ad.status === 'loaded', error: ad.error };
}

/**
 * Subscribes to an ad the caller already owns (for example one preloaded at app startup with
 * `createInterstitialAd`). Does not create or release it.
 *
 * The state is keyed on the ad instance. `useEvent` cannot be used: its `initialValue` is only
 * `useState`'s initial argument, so state from a previous ad would carry over — `isLoaded`
 * would stay true while a freshly created ad is still loading. Resetting during render is
 * React's own answer to that.
 */
export function useInterstitialAdState(ad: InterstitialAd): FullScreenAdState {
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
 * Creates an interstitial ad and releases it on unmount.
 *
 * `requestOptions` is only read at creation time; changing it later has no effect. Call the
 * hook again with a different `adUnitId` to get a new ad.
 */
export function useInterstitialAd(
  options: FullScreenAdOptions
): FullScreenAdState & { ad: InterstitialAd } {
  const ad = useReleasingSharedObject<InterstitialAd>(() => {
    const created: NativeInterstitialAd = new NativeModule.InterstitialAd(
      options.adUnitId,
      options.requestOptions
    );
    loadFullScreenAdWhenInitialized(created);
    return attachShow(created);
  }, [options.adUnitId]);

  return { ...useInterstitialAdState(ad), ad };
}
