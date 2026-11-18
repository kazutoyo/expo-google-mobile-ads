import type { SharedObject } from 'expo-modules-core/types';

import { NativeObjects } from './ExpoGoogleMobileAdsModule';
import {
  ShowAdError,
  assertShowable,
  loadFullScreenAdWhenInitialized,
  type FullScreenAdOptions,
} from './FullScreenAd';
import type { FullScreenAdEvents } from './InterstitialAd';
import type { AdError, AdReward, FullScreenAdStatus, ResponseInfo } from './types';

export type RewardedInterstitialAdEvents = FullScreenAdEvents & {
  earnedReward: (payload: AdReward) => void;
};

export declare class NativeRewardedInterstitialAd extends SharedObject<RewardedInterstitialAdEvents> {
  readonly status: FullScreenAdStatus;
  readonly error?: AdError;
  readonly responseInfo?: ResponseInfo;
  /** Offered reward, not evidence of earning. Use earnedReward for mediation reward grants. */
  readonly reward?: AdReward;
  load(): void;
  markLoadFailed(message: string): void;
  showAsync(): Promise<AdReward | null>;
}

export type RewardedInterstitialAd = NativeRewardedInterstitialAd & {
  /**
   * Resolves on dismissal with the reward received by that point, or null.
   * A mediated iOS SDK may deliver earnedReward after dismissal. Use that event as the
   * sole grant path when mediating, and keep the ad/subscription alive for its callback.
   */
  show(): Promise<AdReward | null>;
};

export function attachShow(ad: NativeRewardedInterstitialAd): RewardedInterstitialAd {
  const withShow = ad as RewardedInterstitialAd;
  withShow.show = async () => {
    assertShowable(withShow);
    try {
      return await ad.showAsync();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ShowAdError('failedToShow', message, { cause: error });
    }
  };
  return withShow;
}

/** Preloads an ad. Show an introduction with a skip option before calling show(). */
export function createRewardedInterstitialAd(options: FullScreenAdOptions): RewardedInterstitialAd {
  const ad: NativeRewardedInterstitialAd = new NativeObjects.RewardedInterstitialAd(
    options.adUnitId,
    options.requestOptions
  );
  loadFullScreenAdWhenInitialized(ad);
  return attachShow(ad);
}
