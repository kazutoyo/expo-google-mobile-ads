---
title: "Introduction"
description: "An Expo Modules native wrapper for the Google Mobile Ads (AdMob) SDK."
---

An Expo Modules native wrapper for the [Google Mobile Ads (AdMob)](https://developers.google.com/admob) SDK. Android uses the [GMA Next-Gen SDK](https://developers.google.com/admob/android/next-gen/quick-start); iOS uses the Google Mobile Ads SDK v13.

```sh
npx expo install @kazutoyo/expo-google-mobile-ads
```

## What it does

- **Banner ads** — fixed and adaptive sizes. An ad is created independently of the view that displays it, so loading can start before the screen exists.
- **Interstitial and rewarded ads** — preloadable in the same way. `show()` returns a promise, and a rewarded ad resolves with the reward the user earned.
- **UMP consent** — gathering consent, showing the form, and reopening the privacy options.
- **Config plugin** — writes your App IDs into the native projects, and adds mediation adapter dependencies.

Native ads, app-open ads, and server-side verification for rewarded ads are not supported.

## Requirements

- **Expo SDK 57+**, declared as a `peerDependencies` constraint. A mismatched version surfaces at install time instead of failing later in the native build.
- **New Architecture only.** Old Architecture is not supported.
- **iOS 16.4+**, **Android minSdk 24+**.

The iOS floor comes from Expo, not from the ads SDK. `ExpoModulesCore` declares `:ios => '16.4'` from SDK 56 on, while the ads SDK v13 itself only needs iOS 13. An app whose `ios.deploymentTarget` is lower cannot install this pod.

The module contains native code, so **it does not run in Expo Go**. You need a development build.

## Getting started

1. [Installation](/installation) — pass your App IDs to the config plugin.
2. [Consent (UMP)](/consent) — gather consent.
3. [Initializing the SDK](/initialization) — call `initialize()`.
4. [Banner ads](/banner-ads) and [interstitial and rewarded ads](/fullscreen-ads) — load and show ads.
