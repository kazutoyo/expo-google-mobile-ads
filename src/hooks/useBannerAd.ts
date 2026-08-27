import { useEventListener } from 'expo';
import { useReleasingSharedObject } from 'expo-modules-core';
import { useState } from 'react';

import { isReleased, loadWhenInitialized, type BannerAd, type BannerAdOptions } from '../BannerAd';
import type { BannerAdSize } from '../BannerAdSize';
import NativeModule from '../ExpoGoogleMobileAdsModule';
import type { AdError } from '../types';

export type BannerAdState = {
  isLoaded: boolean;
  error?: AdError;
  loadedSize?: BannerAdSize;
};

/**
 * Reads the ad's current state straight off the native object.
 *
 * A released ad reports an empty state instead: every property getter of a released shared
 * object throws `SharedObject.NotFoundException`, and that would propagate out of a React
 * render. Callers can legitimately still be holding (and rendering) an ad they just released.
 */
function readState(ad: BannerAd): BannerAdState {
  if (isReleased(ad)) {
    return { isLoaded: false };
  }
  return {
    isLoaded: ad.status === 'loaded',
    error: ad.error,
    loadedSize: ad.loadedSize,
  };
}

/**
 * Subscribes to an ad that already exists (e.g. one preloaded outside a View with
 * `createBannerAd`).
 *
 * Does not create or release the ad — the caller is responsible for its lifetime.
 *
 * The state is keyed on the ad instance. `useEvent` cannot be used here: its `initialValue` is
 * only `useState`'s initial argument, so when the caller passes a different ad the state of the
 * *previous* one carries over — `isLoaded` stays true while a freshly created ad is still
 * loading (a rotation with `useBannerAdSize` does exactly that, and the documented
 * `{isLoaded && <BannerAdView/>}` pattern then renders a blank banner), and an old error sticks
 * to a healthy new ad. Resetting during render is React's own answer to that
 * (https://react.dev/reference/react/useState#storing-information-from-previous-renders).
 */
export function useBannerAdState(ad: BannerAd): BannerAdState {
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
    loadWhenInitialized(created);
    return created;
  }, [options.adUnitId, options.size.width, options.size.height]);

  return { ...useBannerAdState(ad), ad };
}
