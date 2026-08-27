import type { SharedObject } from 'expo-modules-core/types';

import type { BannerAdSize } from './BannerAdSize';
import NativeModule from './ExpoGoogleMobileAdsModule';
import { runWhenInitialized } from './initialization';
import type {
  AdError,
  BannerAdStatus,
  PaidEventValue,
  RequestOptions,
  ResponseInfo,
} from './types';

export type BannerAdEvents = {
  statusChange: (payload: { status: BannerAdStatus; error?: AdError }) => void;
  impression: () => void;
  clicked: () => void;
  paid: (payload: PaidEventValue) => void;
};

export declare class BannerAd extends SharedObject<BannerAdEvents> {
  /** The requested size. Used to reserve space before the ad loads. */
  readonly size: BannerAdSize;
  readonly status: BannerAdStatus;
  readonly error?: AdError;
  readonly loadedSize?: BannerAdSize;
  readonly responseInfo?: ResponseInfo;
  /** Used to retry after a failure or to reload manually. */
  load(): void;
  // release() and addListener() are inherited from SharedObject
}

export type BannerAdOptions = {
  adUnitId: string;
  size: BannerAdSize;
  requestOptions?: RequestOptions;
};

/**
 * Creates a banner ad and starts loading it. No View is required.
 *
 * If the SDK hasn't finished initializing yet, the load is deferred until it does.
 */
export function createBannerAd(options: BannerAdOptions): BannerAd {
  const ad: BannerAd = new NativeModule.BannerAd(
    options.adUnitId,
    options.size,
    options.requestOptions
  );

  runWhenInitialized(() => ad.load());

  return ad;
}
