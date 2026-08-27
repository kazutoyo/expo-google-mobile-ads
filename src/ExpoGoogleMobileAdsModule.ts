import { requireNativeModule } from 'expo';

import type { InitializationStatus, RequestConfiguration } from './types';

declare class ExpoGoogleMobileAdsModule {
  BannerAd: any;
  initializeAsync(): Promise<InitializationStatus>;
  setRequestConfiguration(config: RequestConfiguration): void;
  getAnchoredAdaptiveSize(width: number, orientation: string): { width: number; height: number };
  getLargeAnchoredAdaptiveSize(width: number, orientation: string): { width: number; height: number };
  getInlineAdaptiveSize(width: number, maxHeight: number): { width: number; height: number };
}

export default requireNativeModule<ExpoGoogleMobileAdsModule>('ExpoGoogleMobileAds');
