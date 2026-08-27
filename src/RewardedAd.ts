import type { SharedObject } from 'expo-modules-core/types';

import NativeModule from './ExpoGoogleMobileAdsModule';
import {
  ShowAdError,
  assertShowable,
  loadFullScreenAdWhenInitialized,
  type FullScreenAdOptions,
} from './FullScreenAd';
import type { FullScreenAdEvents } from './InterstitialAd';
import type { AdError, AdReward, FullScreenAdStatus, ResponseInfo } from './types';

export type RewardedAdEvents = FullScreenAdEvents & {
  earnedReward: (payload: AdReward) => void;
};

export declare class NativeRewardedAd extends SharedObject<RewardedAdEvents> {
  readonly status: FullScreenAdStatus;
  readonly error?: AdError;
  readonly responseInfo?: ResponseInfo;
  /**
   * What this ad offers, readable before it is shown so a prompt can say what the user will
   * get. Its presence does NOT mean the reward was earned — only `show()`'s resolved value
   * says that.
   */
  readonly reward?: AdReward;
  load(): void;
  /** @internal */
  markLoadFailed(message: string): void;
  /** @internal Use `show()`. */
  showAsync(): Promise<AdReward | null>;
}

export type RewardedAd = NativeRewardedAd & {
  /**
   * Presents the ad. Resolves with the earned reward when the user dismisses it, or `null`
   * if they dismissed it without earning one.
   *
   * Rejects with a `ShowAdError` whose `code` is `notLoaded`, `alreadyShown`, or
   * `failedToShow`.
   */
  show(): Promise<AdReward | null>;
};

/**
 * @internal Attaches the `show()` wrapper to a native rewarded ad. Exported so Task 4's
 * hooks can reuse it for ads they create themselves, without going through
 * `createRewardedAd`.
 */
export function attachShow(ad: NativeRewardedAd): RewardedAd {
  const withShow = ad as RewardedAd;
  withShow.show = async () => {
    assertShowable(withShow);
    try {
      return await ad.showAsync();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ShowAdError('failedToShow', message);
    }
  };
  return withShow;
}

/**
 * Creates a rewarded ad and starts loading it. No view is involved, so this can be called
 * outside React.
 *
 * The ad is single-use: after `show()` its status is `'shown'`. Create a new one for the
 * next impression.
 */
export function createRewardedAd(options: FullScreenAdOptions): RewardedAd {
  const ad: NativeRewardedAd = new NativeModule.RewardedAd(
    options.adUnitId,
    options.requestOptions
  );
  loadFullScreenAdWhenInitialized(ad);
  return attachShow(ad);
}
