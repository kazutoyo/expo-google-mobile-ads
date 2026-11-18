---
title: "Swipeable interstitial ads"
description: "Embed interstitial creatives in your own full-screen view or paged feed."
sidebar:
  order: 6.5
---

Swipeable interstitials load independently of their view, like banners. Your app places the ad in a full-screen container and controls navigation, swipe gestures and dismissal. There is no `show()` method and no built-in swipe-to-dismiss control. The underlying APIs are currently beta/experimental on [iOS](https://developers.google.com/admob/ios/api/beta/reference/Classes/GADSwipeableInterstitialAd) and [Android](https://developers.google.com/admob/android/next-gen/reference/kotlin/com/google/android/libraries/ads/mobile/sdk/swipeableinterstitial/SwipeableInterstitialAd).

Call `initialize()` after consent permits requesting ads, as described in [initialization](/initialization). Loads are queued until initialization completes.

```tsx
import {
  SwipeableInterstitialAdView,
  useSwipeableInterstitialAd,
} from '@kazutoyo/expo-google-mobile-ads';

// Place this screen in a full-screen route or page. Replace adUnitId with a
// swipeable-interstitial ad unit configured for your account.
export function SwipeableAdPage({ adUnitId }: { adUnitId: string }) {
  const { ad, isLoaded, error } = useSwipeableInterstitialAd({ adUnitId });
  if (error || !isLoaded) return null; // Your feed can skip the ad slot.
  return <SwipeableInterstitialAdView ad={ad} style={{ flex: 1 }} />;
}
```

The default request uses the device's full-screen size. For a custom container, pass `size: { width, height }` in points (iOS) or dp (Android) and give the view matching dimensions. Both dimensions must be positive integers; the SDK rejects sizes too small for an interstitial experience. The view reserves the layout specified by `style` while loading; it does not calculate a height for you.

`useSwipeableInterstitialAd(options)` owns the ad and releases it on unmount. Changes to `adUnitId`, the dimensions or `maxScreenHoldDuration` create a new ad; `requestOptions` is read only at creation. For preloading outside React, use `createSwipeableInterstitialAd(options)`, observe it with `useSwipeableInterstitialAdState(ad)`, and call `ad.release()` when finished. Unmounting `SwipeableInterstitialAdView` only detaches the creative. Mount an ad in one view at a time, and use a new ad for each new feed placement.

## Screen hold duration

`maxScreenHoldDuration` defaults to `0`, requesting ads with no required hold time. Only set it above zero if your app implements visibility tracking and prevents dismissal/navigation for the loaded ad's `minScreenHoldDuration` seconds. It must be a non-negative integer. Merely mounting the view or receiving `screenHoldTimerStarted` does not enforce this requirement. Pause/reset your own timer as appropriate when the page is hidden or the app enters the background; the wrapper does not manage navigation or timers.

## State and events

The ad has `status` (`'loading' | 'loaded' | 'error'`), `error`, `responseInfo`, `minScreenHoldDuration` (seconds), `load()` and `release()`. Calling `load()` replaces the previous creative; release discards pending results and removes the native view. Both hooks return `{ isLoaded, error, minScreenHoldDuration }`; the owning hook also returns `ad`.

Subscribe using `ad.addListener(event, listener)` and remove the returned subscription when finished:

| Event | Meaning |
| --- | --- |
| `statusChange` | `{ status, error? }`; loading completed, failed or restarted |
| `impression` | The SDK recorded an impression |
| `clicked` | The SDK recorded a click |
| `paid` | `{ value, currencyCode, precision }`, same as other formats |
| `screenPresented` | A click opened a full-screen overlay |
| `screenDismissed` | That overlay closed |
| `screenHoldTimerStarted` | Informational SDK hold-timer signal |

`screenPresented` and `screenDismissed` refer to an overlay opened by interacting with the ad. They do not report mounting or dismissing your feed page.
