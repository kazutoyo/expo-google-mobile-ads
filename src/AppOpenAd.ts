import type { SharedObject } from 'expo-modules-core/types';

import { NativeObjects } from './ExpoGoogleMobileAdsModule';
import {
  ShowAdError,
  assertShowable,
  loadFullScreenAdWhenInitialized,
  type FullScreenAdOptions,
} from './FullScreenAd';
import type { FullScreenAdEvents } from './InterstitialAd';
import type { AdError, FullScreenAdStatus, ResponseInfo } from './types';

export declare class NativeAppOpenAd extends SharedObject<FullScreenAdEvents> {
  readonly status: FullScreenAdStatus;
  readonly error?: AdError;
  readonly responseInfo?: ResponseInfo;
  load(): void;
  markLoadFailed(message: string): void;
  showAsync(): Promise<void>;
}

export type AppOpenAd = NativeAppOpenAd & {
  show(): Promise<void>;
};

export function attachShow(ad: NativeAppOpenAd): AppOpenAd {
  const withShow = ad as AppOpenAd;
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

/** Preloads a single-use app open ad. No automatic presentation; expires four hours after load. */
export function createAppOpenAd(options: FullScreenAdOptions): AppOpenAd {
  const ad: NativeAppOpenAd = new NativeObjects.AppOpenAd(options.adUnitId, options.requestOptions);
  loadFullScreenAdWhenInitialized(ad);
  return attachShow(ad);
}
