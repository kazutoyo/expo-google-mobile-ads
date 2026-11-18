import { useEventListener } from 'expo';
import { useReleasingSharedObject } from 'expo-modules-core';
import { useState } from 'react';

import { isFullScreenAdReleased } from '../FullScreenAd';
import {
  createNativeAd,
  type NativeAd,
  type NativeAdOptions,
  type NativeAdAssets,
} from '../NativeAd';
import type { AdError } from '../types';

export type NativeAdState = { isLoaded: boolean; error?: AdError; assets?: NativeAdAssets };
function readState(ad: NativeAd): NativeAdState {
  if (isFullScreenAdReleased(ad)) return { isLoaded: false };
  return { isLoaded: ad.status === 'loaded', error: ad.error, assets: ad.assets };
}

/** Observes an existing ad without taking ownership. */
export function useNativeAdState(ad: NativeAd): NativeAdState {
  const [state, setState] = useState(() => readState(ad));
  const [owner, setOwner] = useState(ad);
  if (owner !== ad) {
    setOwner(ad);
    setState(readState(ad));
  }
  useEventListener(ad, 'statusChange', () => setState(readState(ad)));
  return state;
}

/** Owns an ad until unmount or adUnitId changes. Request options are read at creation. */
export function useNativeAd(options: NativeAdOptions): NativeAdState & { ad: NativeAd } {
  const ad = useReleasingSharedObject(() => createNativeAd(options), [options.adUnitId]);
  return { ...useNativeAdState(ad), ad };
}
