import { useEventListener } from 'expo';
import { useReleasingSharedObject } from 'expo-modules-core';
import { useState } from 'react';

import { attachShow } from '../AppOpenAd';
import type { AppOpenAd, NativeAppOpenAd } from '../AppOpenAd';
import { NativeObjects } from '../ExpoGoogleMobileAdsModule';
import { isFullScreenAdReleased, loadFullScreenAdWhenInitialized } from '../FullScreenAd';
import type { FullScreenAdOptions } from '../FullScreenAd';
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

export function useAppOpenAdState(ad: AppOpenAd): FullScreenAdState {
  const [state, setState] = useState(() => readState(ad));
  const [stateOwner, setStateOwner] = useState(ad);

  if (stateOwner !== ad) {
    setStateOwner(ad);
    setState(readState(ad));
  }

  useEventListener(ad, 'statusChange', () => setState(readState(ad)));

  return state;
}

export function useAppOpenAd(options: FullScreenAdOptions): FullScreenAdState & { ad: AppOpenAd } {
  const ad = useReleasingSharedObject<AppOpenAd>(() => {
    const created: NativeAppOpenAd = new NativeObjects.AppOpenAd(
      options.adUnitId,
      options.requestOptions
    );
    loadFullScreenAdWhenInitialized(created);
    return attachShow(created);
  }, [options.adUnitId]);

  return { ...useAppOpenAdState(ad), ad };
}
