# @kazutoyo/expo-google-mobile-ads

[![npm](https://img.shields.io/npm/v/@kazutoyo/expo-google-mobile-ads)](https://www.npmjs.com/package/@kazutoyo/expo-google-mobile-ads)
[![CI](https://github.com/kazutoyo/expo-google-mobile-ads/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/kazutoyo/expo-google-mobile-ads/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/@kazutoyo/expo-google-mobile-ads)](LICENSE)

*(English | [日本語](./README.ja.md))*

An Expo Modules native wrapper for the [Google Mobile Ads (AdMob)](https://developers.google.com/admob) SDK. Currently supports banner, interstitial, and rewarded ads, plus UMP consent management.

📖 **[Documentation](https://kazutoyo.github.io/expo-google-mobile-ads/)** — installation, consent, every ad format, and the full API reference.

## Why this library

The existing `react-native-google-mobile-ads` targets React Native (TurboModules) and still carries Old Architecture compatibility baggage. The biggest cost of that: **ads can't be preloaded** — an ad can only be created together with the view that displays it.

This library is built on the Expo Modules API (`SharedObject`), with the ad instance and the display view deliberately kept separate.

- **Preloadable** — `createBannerAd()` can be called outside React, before a screen transition or at app startup. Loading starts without waiting for a view — it is queued until `initialize()` completes — and the view can be attached later.
- **Reusable across screens** — `<BannerAdView ad={ad} />` **only detaches, never destroys**, the ad on unmount. The same ad instance can be shown again on a different screen.
- **Hooks-based** — from React, `useBannerAd` / `useBannerAdState` are thin wrappers, nothing more.
- **No layout shift** — `BannerAdSize` computes sizes with a synchronous function that doesn't wait for a load, so the display area can be reserved before the ad arrives.

Android uses the [GMA Next-Gen SDK](https://developers.google.com/admob/android/next-gen/quick-start); iOS uses the Google Mobile Ads SDK v13.

## Scope

- **New Architecture only.** Old Architecture is not supported.
- **Expo SDK 57+**, **iOS 16.4+**, **Android minSdk 24+**.
- Banner, interstitial, rewarded ads, and UMP consent.

Not yet supported: native ads, app-open ads, and server-side verification for rewarded ads.

## Installation

```sh
npx expo install @kazutoyo/expo-google-mobile-ads
```

This module contains native code, so **it does not run in Expo Go** — you need a development build.

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

See the [installation guide](https://kazutoyo.github.io/expo-google-mobile-ads/installation) for what the plugin validates and why, and the [consent guide](https://kazutoyo.github.io/expo-google-mobile-ads/consent) for the UMP flow in full.

## Documentation

| | |
|---|---|
| [Installation](https://kazutoyo.github.io/expo-google-mobile-ads/installation) | Config plugin, App IDs, development builds |
| [Initializing the SDK](https://kazutoyo.github.io/expo-google-mobile-ads/initialization) | Why the library never initializes itself |
| [Consent (UMP)](https://kazutoyo.github.io/expo-google-mobile-ads/consent) | The consent flow, `useConsentInfo()`, testing |
| [Banner ads](https://kazutoyo.github.io/expo-google-mobile-ads/banner-ads) | Preloading, hooks, auto-refresh |
| [BannerAdSize](https://kazutoyo.github.io/expo-google-mobile-ads/banner-sizes) | Fixed and adaptive sizes |
| [Interstitial and rewarded ads](https://kazutoyo.github.io/expo-google-mobile-ads/fullscreen-ads) | Single-use full-screen ads, rewards |
| [Mediation](https://kazutoyo.github.io/expo-google-mobile-ads/mediation) | Adding adapters through the config plugin |
| [API reference](https://kazutoyo.github.io/expo-google-mobile-ads/api-reference) | Everything exported from the package root |

## Contributing

The documentation site lives in [`website/`](website) and is built with [Blume](https://useblume.dev/). `cd website && npm install && npm run dev` to work on it.

## License

MIT
