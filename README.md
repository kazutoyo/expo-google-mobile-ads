# @kazutoyo/expo-google-mobile-ads

[![npm](https://img.shields.io/npm/v/@kazutoyo/expo-google-mobile-ads)](https://www.npmjs.com/package/@kazutoyo/expo-google-mobile-ads)
[![CI](https://github.com/kazutoyo/expo-google-mobile-ads/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/kazutoyo/expo-google-mobile-ads/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/@kazutoyo/expo-google-mobile-ads)](LICENSE)

*(English | [日本語](./README.ja.md))*

An Expo Modules native wrapper for the [Google Mobile Ads (AdMob)](https://developers.google.com/admob) SDK. Currently supports banner, interstitial, and rewarded ads, plus UMP consent management.

📖 **[Documentation](https://kazutoyo.github.io/expo-google-mobile-ads/)** — installation, consent, every ad format, and the full API reference.

## Why this library

This library keeps the ad and the view that displays it as separate objects. An ad is a `SharedObject` from the Expo Modules API, so it exists without a view and starts loading the moment it is created. An ad can be ready before the screen that shows it exists.

- **Preloadable** — `createBannerAd()` can be called outside React, before a screen transition or at app startup. Loading starts without waiting for a view (queued until `initialize()` completes), and the view is attached later.
- **Reusable across screens** — `<BannerAdView ad={ad} />` detaches on unmount without destroying the ad, so the same instance can be shown again on another screen.
- **Thin hooks** — `useBannerAd` / `useBannerAdState` wrap the imperative API and nothing else. When they don't fit, you can use the layer underneath directly.
- **No layout shift** — `BannerAdSize` computes sizes synchronously, without waiting for a load, so the display area can be reserved before the ad arrives.

In `react-native-google-mobile-ads` a banner is a component, `<BannerAd unitId size />`, so a banner ad is created together with the view that displays it. Its interstitial and rewarded ads are standalone objects (`InterstitialAd.createForAdRequest()`) and preload fine. Banners are where the difference shows.

Android uses the [GMA Next-Gen SDK](https://developers.google.com/admob/android/next-gen/quick-start); iOS uses the Google Mobile Ads SDK v13.

## Scope

- **New Architecture only.** Old Architecture is not supported.
- **Expo SDK 57+**, **iOS 16.4+**, **Android minSdk 24+**.
- Banner, interstitial, rewarded ads, and UMP consent.

Native ads, app-open ads, and server-side verification for rewarded ads are not supported yet.

## Installation

```sh
npx expo install @kazutoyo/expo-google-mobile-ads
```

This module contains native code, so **it does not run in Expo Go**. You need a development build.

Pass your AdMob App IDs to the config plugin in `app.json`:

```json
{
  "expo": {
    "plugins": [
      [
        "@kazutoyo/expo-google-mobile-ads",
        {
          "androidAppId": "ca-app-pub-3940256099942544~3347511713",
          "iosAppId": "ca-app-pub-3940256099942544~1458002511"
        }
      ]
    ]
  }
}
```

Then collect consent, initialize, and load an ad:

```typescript
import { gatherConsent, initialize, createBannerAd, BannerAdSize } from '@kazutoyo/expo-google-mobile-ads';

const { canRequestAds } = await gatherConsent();
if (canRequestAds) await initialize();

export const homeBannerAd = createBannerAd({
  adUnitId: 'ca-app-pub-3940256099942544/9214589741',
  size: BannerAdSize.BANNER,
});
```

```tsx
<BannerAdView ad={homeBannerAd} />
```

See the [installation guide](https://kazutoyo.github.io/expo-google-mobile-ads/installation) for what the plugin validates, and the [consent guide](https://kazutoyo.github.io/expo-google-mobile-ads/consent) for the UMP flow in full.

## Documentation

| | |
|---|---|
| [Installation](https://kazutoyo.github.io/expo-google-mobile-ads/installation) | Config plugin, App IDs, development builds |
| [Initializing the SDK](https://kazutoyo.github.io/expo-google-mobile-ads/initialization) | Why the library never initializes itself |
| [Consent (UMP)](https://kazutoyo.github.io/expo-google-mobile-ads/consent) | The consent flow, `useConsentInfo()`, testing |
| [Banner ads](https://kazutoyo.github.io/expo-google-mobile-ads/banner-ads) | Preloading, hooks, auto-refresh |
| [Choosing a banner size](https://kazutoyo.github.io/expo-google-mobile-ads/banner-sizes) | Fixed and adaptive sizes |
| [Interstitial and rewarded ads](https://kazutoyo.github.io/expo-google-mobile-ads/fullscreen-ads) | Single-use full-screen ads, rewards |
| [Mediation](https://kazutoyo.github.io/expo-google-mobile-ads/mediation) | Adding adapters through the config plugin |
| [API](https://kazutoyo.github.io/expo-google-mobile-ads/api) | Everything exported from the package root |

## Contributing

The documentation site lives in [`website/`](website) and is built with [Blume](https://useblume.dev/). Run `cd website && npm install && npm run dev` to work on it.

## License

MIT
