---
title: "Introduction"
description: "An Expo Modules native wrapper for the Google Mobile Ads (AdMob) SDK."
---

An Expo Modules native wrapper for the [Google Mobile Ads (AdMob)](https://developers.google.com/admob) SDK. Currently supports banner, interstitial, and rewarded ads, plus UMP consent management.

## Why this library

The design turns on one decision: the ad and the view that displays it are separate objects. An ad is a `SharedObject` from the Expo Modules API, so it exists without a view and starts loading the moment it is created. An ad can be ready before the screen that shows it exists.

- **Preloadable** — `createBannerAd()` can be called outside React, before a screen transition or at app startup. Loading starts without waiting for a view (queued until `initialize()` completes), and the view is attached later.
- **Reusable across screens** — `<BannerAdView ad={ad} />` detaches on unmount without destroying the ad, so the same instance can be shown again on another screen.
- **Thin hooks** — `useBannerAd` / `useBannerAdState` wrap the imperative API and nothing else. When they don't fit, the layer underneath is right there.
- **No layout shift** — `BannerAdSize` computes sizes synchronously, without waiting for a load, so the display area can be reserved before the ad arrives.

`react-native-google-mobile-ads` targets React Native's TurboModules, where an ad is created together with the view that displays it. If you want to preload, that is the difference that matters.

Android uses the [GMA Next-Gen SDK](https://developers.google.com/admob/android/next-gen/quick-start); iOS uses the Google Mobile Ads SDK v13.

## Scope

- **New Architecture only.** Old Architecture is not supported.
- **Expo SDK 57+** — declared as a `peerDependencies` constraint, so npm/yarn surfaces a
  mismatched install instead of failing later in the native build.
- **iOS 16.4+**, **Android minSdk 24+**. The iOS floor comes from Expo itself
  (`ExpoModulesCore` declares `:ios => '16.4'` from SDK 56 on), not from the ads SDK — Google
  Mobile Ads SDK v13 only needs iOS 13. An app whose `ios.deploymentTarget` is lower than 16.4
  cannot install this pod.
- Banner, interstitial, rewarded ads, and UMP consent (phases 1–3)

Not yet supported:

- Native ads — phase 4
- App-open ads
- Server-side verification for rewarded ads
