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

Not supported: native ads, app-open ads, and server-side verification for rewarded ads.

## Requirements

- **Expo SDK 57+** — declared as a `peerDependencies` constraint, so a mismatched version surfaces at install time instead of failing later in the native build.
- **New Architecture only.** Old Architecture is not supported.
- **iOS 16.4+**, **Android minSdk 24+**. The iOS floor comes from Expo itself — `ExpoModulesCore` declares `:ios => '16.4'` from SDK 56 on — not from the ads SDK, which only needs iOS 13. An app whose `ios.deploymentTarget` is lower cannot install this pod.

The module contains native code, so **it does not run in Expo Go**. You need a development build.

## Getting started

Start with [Installation](/installation), where the config plugin takes your App IDs.

From there: gather consent in [Consent (UMP)](/consent), call `initialize()` as described in [Initializing the SDK](/initialization), and then load [banner](/banner-ads) or [interstitial and rewarded](/fullscreen-ads) ads.
