---
title: "Introduction"
description: "An Expo Modules native wrapper for the Google Mobile Ads (AdMob) SDK."
---

An Expo Modules native wrapper for the [Google Mobile Ads (AdMob)](https://developers.google.com/admob) SDK. Currently supports banner, interstitial, and rewarded ads, plus UMP consent management.

## Why this library

The existing `react-native-google-mobile-ads` targets React Native (TurboModules) and still carries Old Architecture compatibility baggage. The biggest cost of that: **ads can't be preloaded** — an ad can only be created together with the view that displays it.

This library is built on the Expo Modules API (`SharedObject`), with the ad instance and the display view deliberately kept separate.

- **Preloadable** — `createBannerAd()` can be called outside React, before a screen transition or at app startup. Loading starts immediately; the view can be attached later.
- **Reusable across screens** — `<BannerAdView ad={ad} />` **only detaches, never destroys**, the ad on unmount. The same ad instance can be shown again on a different screen.
- **Hooks-based** — from React, `useBannerAd` / `useBannerAdState` are thin wrappers, nothing more.
- **No layout shift** — `BannerAdSize` computes sizes with a synchronous function that doesn't wait for a load, so the display area can be reserved before the ad arrives.

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
