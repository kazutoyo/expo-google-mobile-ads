---
title: Native ads
---

# Native ads

Gather consent and call `initialize()` before loading ads.

```tsx
import { Platform } from 'react-native';
import { useNativeAd, NativeAdView } from '@kazutoyo/expo-google-mobile-ads';

const adUnitId = Platform.select({
  android: 'ca-app-pub-3940256099942544/2247696110',
  ios: 'ca-app-pub-3940256099942544/3986624511',
})!;

function SponsoredCard() {
  const { ad, isLoaded, error } = useNativeAd({ adUnitId });
  if (error || !isLoaded) return null;
  return <NativeAdView ad={ad} style={{ height: 360 }} />;
}
```

The view renders a native card with an Ad label, icon, headline, advertiser, media, body and call to action. Optional assets are hidden when absent. The SDK registers the asset views, tracks clicks and impressions, and displays AdChoices. Do not overlay interactive elements on the card.

This initial API provides a built-in card layout; arbitrary React children and custom asset layouts are not supported. Use `style` to size the card (default height: 360). Reserve enough height for the media and text, and at least 120 points/dp for the media.

Pass `layout="fullScreen"` for a page-sized ad: the media fills the view, and an install card with the icon, headline, body and call to action sits at the bottom. Use `bottomInset` to keep points/dp at the bottom clear for app UI drawn over the view, such as a "next" bar. The card sits 8 points/dp above the inset.

```tsx
<NativeAdView ad={ad} layout="fullScreen" bottomInset={80} style={{ flex: 1 }} />
```

`ad.assets` / `useNativeAdState(ad).assets` expose headline, body, callToAction, advertiser, starRating, store, price and mediaAspectRatio. They are metadata; clickable content is rendered by `NativeAdView`.

Only one view can display an ad at a time; attaching to another card clears the old card. Detaching does not release the ad. `load()` replaces the existing ad, clearing the card while the replacement loads. Android destroys stale results and released ads; iOS clears delegates and references.

## API

- `createNativeAd({ adUnitId, requestOptions? })`: preload outside React; call `release()` when finished.
- `useNativeAd(options)`: creates and releases the ad; `requestOptions` is read at creation time.
- `useNativeAdState(ad)`: subscribes without owning or releasing the ad.
- `ad.load()`: retry or reload before presentation.
- `ad.status`, `ad.error`, `ad.responseInfo`: current load state and diagnostics.
- Events: `statusChange`, `impression`, `clicked`, `paid`.

[Google integration guide](https://developers.google.com/admob/ios/native/advanced)
