import type { SharedObject } from 'expo-modules-core/types';

import { NativeObjects } from './ExpoGoogleMobileAdsModule';
import { loadFullScreenAdWhenInitialized } from './FullScreenAd';
import type {
  AdError,
  BannerAdStatus,
  PaidEventValue,
  RequestOptions,
  ResponseInfo,
} from './types';

export type NativeAdOptions = { adUnitId: string; requestOptions?: RequestOptions };
export type NativeAdAssets = {
  headline?: string | null;
  body?: string | null;
  callToAction?: string | null;
  advertiser?: string | null;
  starRating?: number | null;
  store?: string | null;
  price?: string | null;
  mediaAspectRatio: number;
};
export type NativeAdEvents = {
  statusChange: (payload: { status: BannerAdStatus; error?: AdError }) => void;
  impression: () => void;
  clicked: () => void;
  paid: (payload: PaidEventValue) => void;
};
export declare class NativeAd extends SharedObject<NativeAdEvents> {
  readonly status: BannerAdStatus;
  readonly error?: AdError;
  readonly responseInfo?: ResponseInfo;
  readonly assets?: NativeAdAssets;
  load(): void;
  /** @internal */
  markLoadFailed(message: string): void;
}

/** Preloads a native ad without a view. The caller owns its lifetime: call release(). */
export function createNativeAd(options: NativeAdOptions): NativeAd {
  const ad: NativeAd = new NativeObjects.NativeAd(options.adUnitId, options.requestOptions);
  loadFullScreenAdWhenInitialized(ad);
  return ad;
}
