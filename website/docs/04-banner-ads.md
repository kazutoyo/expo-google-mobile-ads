---
title: "Banner ads"
description: "Preload a banner outside React, attach it to a screen, and subscribe to its state."
---

## Preloading

Creating an ad instance (which starts loading) and displaying it on screen are independent. You can create an ad before a screen transition, or at app startup.

```typescript
// e.g. at module scope, or anywhere before a screen transition
import { createBannerAd, BannerAdSize } from '@kazutoyo/expo-google-mobile-ads';

export const homeBannerAd = createBannerAd({
  adUnitId: 'ca-app-pub-3940256099942544/9214589741',
  size: BannerAdSize.BANNER,
});
```

```tsx
// in the screen component
import { useBannerAdState, BannerAdView } from '@kazutoyo/expo-google-mobile-ads';
import { homeBannerAd } from './ads';

function HomeScreen() {
  const { isLoaded } = useBannerAdState(homeBannerAd);

  return <BannerAdView ad={homeBannerAd} />;
}
```

`<BannerAdView>` attaches the native view on mount and **only detaches it on unmount** — the ad itself is not destroyed. Leaving this screen and coming back shows the same ad again, with no reload. To explicitly destroy an ad, call `ad.release()`.

## Hooks

The two hooks differ in what they own of the ad's lifetime.

| hook | creates the ad | releases it on unmount |
|---|---|---|
| `useBannerAd(options)` | yes | **yes** |
| `useBannerAdState(ad)` | no (subscribes to an existing `ad`) | **no** |

For the simple case where the ad's lifetime matches the screen's (no preloading), use `useBannerAd`.

```tsx
import { useBannerAd, BannerAdSize, BannerAdView } from '@kazutoyo/expo-google-mobile-ads';

function Screen() {
  const { ad, isLoaded, error } = useBannerAd({
    adUnitId: 'ca-app-pub-3940256099942544/9214589741',
    size: BannerAdSize.BANNER,
  });

  return <BannerAdView ad={ad} />;
}
```

To just display a preloaded ad on a screen, use `useBannerAdState` (see the preloading example above). This hook neither creates nor releases `ad` — the caller owns its lifetime.

For finer-grained state changes (impressions, clicks, revenue events, and so on), subscribe directly with `ad.addListener(...)`.

```typescript
const subscription = ad.addListener('statusChange', ({ status }) => {
  if (status === 'loaded') {
    // ...
  }
});
```

## Banner auto-refresh

GMA's banner auto-refresh is **a setting in the AdMob console (per ad unit), not an SDK API**. This library has nothing to do with it. To change the refresh interval, use the AdMob console.
