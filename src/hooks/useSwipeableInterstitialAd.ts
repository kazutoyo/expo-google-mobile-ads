import { useEventListener } from 'expo';
import { useReleasingSharedObject } from 'expo-modules-core';
import { useState } from 'react';

import { isReleased } from '../BannerAd';
import { createSwipeableInterstitialAd } from '../SwipeableInterstitialAd';
import type {
  SwipeableInterstitialAd,
  SwipeableInterstitialAdOptions,
} from '../SwipeableInterstitialAd';
import type { AdError } from '../types';

export type SwipeableInterstitialAdState = {
  isLoaded: boolean;
  error?: AdError;
  minScreenHoldDuration: number;
};

function readState(ad: SwipeableInterstitialAd): SwipeableInterstitialAdState {
  if (isReleased(ad)) return { isLoaded: false, minScreenHoldDuration: 0 };
  return {
    isLoaded: ad.status === 'loaded',
    error: ad.error,
    minScreenHoldDuration: ad.minScreenHoldDuration,
  };
}

/** Observes an existing ad without taking ownership of it. */
export function useSwipeableInterstitialAdState(
  ad: SwipeableInterstitialAd
): SwipeableInterstitialAdState {
  const [state, setState] = useState(() => readState(ad));
  const [owner, setOwner] = useState(ad);
  if (owner !== ad) {
    setOwner(ad);
    setState(readState(ad));
  }
  useEventListener(ad, 'statusChange', () => setState(readState(ad)));
  return state;
}

/** Creates an ad and releases it on unmount. requestOptions are read only at creation time. */
export function useSwipeableInterstitialAd(
  options: SwipeableInterstitialAdOptions
): SwipeableInterstitialAdState & { ad: SwipeableInterstitialAd } {
  const ad = useReleasingSharedObject(
    () => createSwipeableInterstitialAd(options),
    [
      options.adUnitId,
      options.size?.width,
      options.size?.height,
      options.maxScreenHoldDuration ?? 0,
    ]
  );
  return { ...useSwipeableInterstitialAdState(ad), ad };
}
