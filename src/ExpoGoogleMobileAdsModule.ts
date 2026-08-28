import { requireNativeModule } from 'expo';

import type {
  ConsentInfo,
  ConsentRequestOptions,
  InitializationStatus,
  RequestConfiguration,
} from './types';

declare class ExpoGoogleMobileAdsModule {
  BannerAd: any;
  InterstitialAd: any;
  RewardedAd: any;
  initializeAsync(): Promise<InitializationStatus>;
  setRequestConfiguration(config: RequestConfiguration): void;
  getAnchoredAdaptiveSize(width: number, orientation: string): { width: number; height: number };
  getLargeAnchoredAdaptiveSize(width: number, orientation: string): { width: number; height: number };
  getInlineAdaptiveSize(width: number, maxHeight: number): { width: number; height: number };
  // UMP. All async because iOS's UMPConsentInformation is main-thread-only, including its
  // property getters — a synchronous Function runs on the JS thread and would have to block on
  // main, which is the deadlock shape documented on runOnMain in BannerAd.swift.
  gatherConsentAsync(options?: ConsentRequestOptions): Promise<ConsentInfo>;
  requestConsentInfoUpdateAsync(options?: ConsentRequestOptions): Promise<ConsentInfo>;
  showConsentFormIfRequiredAsync(): Promise<ConsentInfo>;
  showPrivacyOptionsFormAsync(): Promise<ConsentInfo>;
  getConsentInfoAsync(): Promise<ConsentInfo>;
  resetConsentAsync(): Promise<ConsentInfo>;
}

export default requireNativeModule<ExpoGoogleMobileAdsModule>('ExpoGoogleMobileAds');
