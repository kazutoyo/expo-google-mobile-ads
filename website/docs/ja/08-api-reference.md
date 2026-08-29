---
title: "API リファレンス"
description: "パッケージルートからエクスポートしているもの一覧です。"
---

`src/index.ts` からエクスポートしているものの一覧です。

```typescript
// バナー広告（命令型コア）
export function createBannerAd(options: BannerAdOptions): BannerAd;
export type { BannerAd, BannerAdOptions, BannerAdEvents };

// 表示 View
export function BannerAdView(props: BannerAdViewProps): JSX.Element;
export type { BannerAdViewProps };

// サイズユーティリティ
export const BannerAdSize: { ... };
export type { AdaptiveOptions, BannerAdAdaptiveKind, BannerAdSizeSpec, InlineAdaptiveOptions };

// 初期化
export function initialize(): Promise<InitializationStatus>;
export function setRequestConfiguration(config: RequestConfiguration): void;

// バナー hooks
export function useBannerAd(options: BannerAdOptions): BannerAdState & { ad: BannerAd };
export function useBannerAdState(ad: BannerAd): BannerAdState;
export type { BannerAdState };
export function useBannerAdSize(spec: BannerAdSizeSpec): BannerAdSize;

// インタースティシャル広告
export function createInterstitialAd(options: FullScreenAdOptions): InterstitialAd;
export type { InterstitialAd, FullScreenAdEvents };

// リワード広告
export function createRewardedAd(options: FullScreenAdOptions): RewardedAd;
export type { RewardedAd, RewardedAdEvents };

// フルスクリーン広告（共通）
export class ShowAdError extends Error { code: ShowAdErrorCode; }
export type { FullScreenAdOptions };

// フルスクリーン広告 hooks
export function useInterstitialAd(options: FullScreenAdOptions): FullScreenAdState & { ad: InterstitialAd };
export function useInterstitialAdState(ad: InterstitialAd): FullScreenAdState;
export type { FullScreenAdState };
export function useRewardedAd(options: FullScreenAdOptions): FullScreenAdState & { ad: RewardedAd };
export function useRewardedAdState(ad: RewardedAd): FullScreenAdState;

// 同意管理 (UMP)
export class ConsentError extends Error { code: ConsentErrorCode; }
export function gatherConsent(options?: ConsentRequestOptions): Promise<ConsentInfo>;
export function getConsentInfo(): Promise<ConsentInfo>;
export function requestConsentInfoUpdate(options?: ConsentRequestOptions): Promise<ConsentInfo>;
export function resetConsent(): Promise<ConsentInfo>;
export function showConsentFormIfRequired(): Promise<ConsentInfo>;
export function showPrivacyOptionsForm(): Promise<ConsentInfo>;

// 同意管理 hooks
export function useConsentInfo(): ConsentInfo;

// 型
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
