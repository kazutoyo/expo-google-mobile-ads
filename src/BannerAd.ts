import type { SharedObject } from 'expo-modules-core/types';

import type { BannerAdSize } from './BannerAdSize';
import NativeModule from './ExpoGoogleMobileAdsModule';
import { runWhenInitialized } from './initialization';
import type { AdError, BannerAdStatus, PaidEventValue, RequestOptions, ResponseInfo } from './types';

export type BannerAdEvents = {
  statusChange: (payload: { status: BannerAdStatus; error?: AdError }) => void;
  impression: () => void;
  clicked: () => void;
  paid: (payload: PaidEventValue) => void;
};

export declare class BannerAd extends SharedObject<BannerAdEvents> {
  /** リクエストしたサイズ。ロード前の領域予約に使う。 */
  readonly size: BannerAdSize;
  readonly status: BannerAdStatus;
  readonly error?: AdError;
  readonly loadedSize?: BannerAdSize;
  readonly responseInfo?: ResponseInfo;
  /** 失敗後のリトライや手動リロードに使う。 */
  load(): void;
  // release() と addListener() は SharedObject から継承する
}

export type BannerAdOptions = {
  adUnitId: string;
  size: BannerAdSize;
  requestOptions?: RequestOptions;
};

/**
 * バナー広告を生成し、ロードを開始する。View は不要。
 *
 * SDK の初期化が完了していない場合、ロードは初期化完了まで保留される。
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
