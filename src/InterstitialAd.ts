import type { SharedObject } from 'expo-modules-core/types';

import NativeModule from './ExpoGoogleMobileAdsModule';
import {
  ShowAdError,
  assertShowable,
  loadFullScreenAdWhenInitialized,
  type FullScreenAdOptions,
} from './FullScreenAd';
import type { AdError, FullScreenAdStatus, PaidEventValue, ResponseInfo } from './types';

export type FullScreenAdEvents = {
  statusChange: (payload: { status: FullScreenAdStatus; error?: AdError }) => void;
  showed: () => void;
  dismissed: () => void;
  impression: () => void;
  clicked: () => void;
  paid: (payload: PaidEventValue) => void;
};

export declare class NativeInterstitialAd extends SharedObject<FullScreenAdEvents> {
  readonly status: FullScreenAdStatus;
  readonly error?: AdError;
  readonly responseInfo?: ResponseInfo;
  load(): void;
  /** @internal Reports a failure that happened before the ad could be loaded. */
  markLoadFailed(message: string): void;
  /** @internal Presents the ad. Use `show()`, which checks the ad is showable first. */
  showAsync(): Promise<void>;
}

export type InterstitialAd = NativeInterstitialAd & {
  /**
   * Presents the ad. Resolves when the user dismisses it.
   *
   * Rejects with a `ShowAdError` whose `code` is `notLoaded` (the ad is not ready — check
   * `isLoaded` first), `alreadyShown` (these ads are single-use), or `failedToShow` (the SDK
   * could not present it).
   */
  show(): Promise<void>;
};

/**
 * @internal Attaches the `show()` wrapper to a native interstitial ad. Exported so Task 4's
 * hooks can reuse it for ads they create themselves, without going through
 * `createInterstitialAd`.
 */
export function attachShow(ad: NativeInterstitialAd): InterstitialAd {
  const withShow = ad as InterstitialAd;
  withShow.show = async () => {
    assertShowable(withShow);
    try {
      await ad.showAsync();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ShowAdError('failedToShow', message, { cause: error });
    }
  };
  return withShow;
}

/**
 * Creates an interstitial ad and starts loading it. No view is involved, so this can be
 * called outside React — at app startup, or before a screen transition.
 *
 * The ad is single-use: after `show()` its status is `'shown'` and it cannot be reloaded.
 * Create a new one for the next impression.
 */
export function createInterstitialAd(options: FullScreenAdOptions): InterstitialAd {
  const ad: NativeInterstitialAd = new NativeModule.InterstitialAd(
    options.adUnitId,
    options.requestOptions
  );
  loadFullScreenAdWhenInitialized(ad);
  return attachShow(ad);
}
