# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-08-28

First release.

### Added

- SDK initialization: `initialize()` and `setRequestConfiguration()`. Ad loads
  requested before initialization finishes are queued rather than dropped, so a
  screen mounted during startup does not have to wait for the SDK itself.

- Banner ads: `createBannerAd()` and `<BannerAdView />`, with the
  `useBannerAd()` / `useBannerAdState()` hooks. Loading is separated from
  rendering so a banner can be prepared before the screen that shows it exists,
  which is what keeps an empty slot off the first frame.

- `BannerAdSize`, including the adaptive sizes, and `useBannerAdSize()` for
  resolving one against the current window.

- Interstitial and rewarded ads: `createInterstitialAd()`,
  `createRewardedAd()`, `useInterstitialAd()`, `useRewardedAd()` and their
  `*State` variants. `show()` rejects with a typed `ShowAdError` instead of
  failing silently, and a loaded ad is single-use — the object is spent once
  shown.

- UMP consent: `gatherConsent()` for the common one-call flow, plus
  `requestConsentInfoUpdate()`, `showConsentFormIfRequired()`,
  `getConsentInfo()`, `showPrivacyOptionsForm()` and `resetConsent()` for
  driving the steps individually. `useConsentInfo()` exposes the current
  consent state to a screen — a privacy-options entry point, for instance, has
  to be hidden when the form is not required.

- Config plugin: `androidAppId` / `iosAppId` are written into the native
  manifest and Info.plist at prebuild. The plugin fails the build on a missing
  or malformed AdMob App ID rather than leaving it to a crash on first launch.

- Mediation adapters are supported through the standard native dependency
  mechanisms; see the README for what has to be added per platform.
