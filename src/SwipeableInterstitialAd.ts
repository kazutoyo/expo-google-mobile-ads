import type { SharedObject } from 'expo-modules-core/types';

import { loadWhenInitialized } from './BannerAd';
import { NativeObjects } from './ExpoGoogleMobileAdsModule';
import type {
  AdError,
  BannerAdStatus,
  PaidEventValue,
  RequestOptions,
  ResponseInfo,
} from './types';

export type SwipeableInterstitialAdOptions = {
  adUnitId: string;
  /** Requested size in points/dp. Omit to request the device's full screen size. */
  size?: { width: number; height: number };
  /**
   * Maximum hold time in whole seconds. Defaults to 0 (no hold required).
   * Set only if your app enforces the returned minScreenHoldDuration before allowing dismissal.
   */
  maxScreenHoldDuration?: number;
  requestOptions?: RequestOptions;
};

export type SwipeableInterstitialAdEvents = {
  statusChange: (payload: { status: BannerAdStatus; error?: AdError }) => void;
  impression: () => void;
  clicked: () => void;
  paid: (payload: PaidEventValue) => void;
  /** A click opened a full screen overlay; this does not mean the ad view was mounted. */
  screenPresented: () => void;
  /** The click overlay closed; this does not mean the ad view was dismissed. */
  screenDismissed: () => void;
  /** Informational SDK signal. The app must manage its own visibility and hold timer. */
  screenHoldTimerStarted: () => void;
};

/** A view-based interstitial. The app controls placement, gestures and dismissal. */
export declare class SwipeableInterstitialAd extends SharedObject<SwipeableInterstitialAdEvents> {
  readonly status: BannerAdStatus;
  readonly error?: AdError;
  readonly responseInfo?: ResponseInfo;
  /** Required visible hold time in seconds, available after loading. */
  readonly minScreenHoldDuration: number;
  load(): void;
  /** @internal */
  markLoadFailed(message: string): void;
}

/** @internal Shared by the factory and the owning hook. */
export function validateSwipeableInterstitialAdOptions(
  options: SwipeableInterstitialAdOptions
): void {
  const { size, maxScreenHoldDuration = 0 } = options;
  if (
    size &&
    ![size.width, size.height].every(
      (value) => Number.isInteger(value) && value > 0 && value <= 2147483647
    )
  ) {
    throw new RangeError('Swipeable interstitial size must contain positive integer dimensions.');
  }
  if (
    !Number.isInteger(maxScreenHoldDuration) ||
    maxScreenHoldDuration < 0 ||
    maxScreenHoldDuration > 2147483647
  ) {
    throw new RangeError('maxScreenHoldDuration must be a non-negative integer in seconds.');
  }
}

/** Creates and preloads an ad. Call initialize() first; release() when finished with it. */
export function createSwipeableInterstitialAd(
  options: SwipeableInterstitialAdOptions
): SwipeableInterstitialAd {
  validateSwipeableInterstitialAdOptions(options);
  const ad: SwipeableInterstitialAd = new NativeObjects.SwipeableInterstitialAd(
    options.adUnitId,
    options.size,
    options.maxScreenHoldDuration ?? 0,
    options.requestOptions
  );
  loadWhenInitialized(ad);
  return ad;
}
