---
title: "API reference"
description: "Everything exported from the package root."
---

Everything exported from `src/index.ts`:

```typescript
// Banner ads (imperative core)
export function createBannerAd(options: BannerAdOptions): BannerAd;
export type { BannerAd, BannerAdOptions, BannerAdEvents };

// Display view
export function BannerAdView(props: BannerAdViewProps): JSX.Element;
export type { BannerAdViewProps };

// Size utilities
export const BannerAdSize: { ... };
export type { AdaptiveOptions, BannerAdAdaptiveKind, BannerAdSizeSpec, InlineAdaptiveOptions };

// Initialization
export function initialize(): Promise<InitializationStatus>;
export function setRequestConfiguration(config: RequestConfiguration): void;

// Banner hooks
export function useBannerAd(options: BannerAdOptions): BannerAdState & { ad: BannerAd };
export function useBannerAdState(ad: BannerAd): BannerAdState;
export type { BannerAdState };
export function useBannerAdSize(spec: BannerAdSizeSpec): BannerAdSize;

// Interstitial ads
export function createInterstitialAd(options: FullScreenAdOptions): InterstitialAd;
export type { InterstitialAd, FullScreenAdEvents };

// Rewarded ads
export function createRewardedAd(options: FullScreenAdOptions): RewardedAd;
export type { RewardedAd, RewardedAdEvents };

// Full-screen ads (shared)
export class ShowAdError extends Error { code: ShowAdErrorCode; }
export type { FullScreenAdOptions };

// Full-screen ad hooks
export function useInterstitialAd(options: FullScreenAdOptions): FullScreenAdState & { ad: InterstitialAd };
export function useInterstitialAdState(ad: InterstitialAd): FullScreenAdState;
export type { FullScreenAdState };
export function useRewardedAd(options: FullScreenAdOptions): FullScreenAdState & { ad: RewardedAd };
export function useRewardedAdState(ad: RewardedAd): FullScreenAdState;

// Consent (UMP)
export class ConsentError extends Error { code: ConsentErrorCode; }
export function gatherConsent(options?: ConsentRequestOptions): Promise<ConsentInfo>;
export function getConsentInfo(): Promise<ConsentInfo>;
export function requestConsentInfoUpdate(options?: ConsentRequestOptions): Promise<ConsentInfo>;
export function resetConsent(): Promise<ConsentInfo>;
export function showConsentFormIfRequired(): Promise<ConsentInfo>;
export function showPrivacyOptionsForm(): Promise<ConsentInfo>;

// Consent hooks
export function useConsentInfo(): ConsentInfo;

// types
export type {
  AdError,
  AdReward,
  AdapterResponse,
  BannerAdStatus,
  ConsentErrorCode,
  ConsentInfo,
  ConsentRequestOptions,
  ConsentStatus,
  DebugGeography,
  FullScreenAdStatus,
  InitializationStatus,
  PaidEventValue,
  PrivacyOptionsRequirementStatus,
  RequestConfiguration,
  RequestOptions,
  ResponseInfo,
  ShowAdErrorCode,
};
```
