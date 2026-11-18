---
title: App open ads
---

# App open ads

Gather consent and call `initialize()` before loading ads.

```tsx
import { Platform } from 'react-native';
import { useAppOpenAd } from '@kazutoyo/expo-google-mobile-ads';

const adUnitId = Platform.select({
  android: 'ca-app-pub-3940256099942544/9257395921',
  ios: 'ca-app-pub-3940256099942544/5575463023',
})!;

const { ad, isLoaded, error } = useAppOpenAd({ adUnitId });
// Call from your app's chosen placement, only when ready.
if (isLoaded) {
  await ad.show();
  // The promise resolves when the ad is dismissed.
}
```

Call `show()` from your loading screen or foreground flow after checking readiness. The library does not automatically subscribe to AppState or present ads on launch. Skip the placement if loading has not finished; do not interrupt content later when a request completes.

An app open ad expires four hours after load. Both platforms reject expired ads (`ShowAdError` with `code: 'notLoaded'` when checked by JS); `ad.status` reads `error`. An expiry timer emits a status change so hooks stop reporting the ad as loaded. Age is measured by a sleep-inclusive monotonic clock (ContinuousClock on iOS and elapsedRealtime on Android). Foreground/resume revalidation updates native state and emits statusChange even when a device sleep delayed the timer. Status reads and presentation also check expiry. Always handle `show()` rejection. Replace or reload an unused expired ad. Ads are single-use after presentation; create a new ad for the next placement.

## API

- `createAppOpenAd({ adUnitId, requestOptions? })`: preload outside React; call `release()` when finished.
- `useAppOpenAd(options)`: creates and releases the ad; `requestOptions` is read at creation time.
- `useAppOpenAdState(ad)`: subscribes without owning or releasing the ad.
- `ad.load()`: retry or reload before presentation.
- `ad.status`, `ad.error`, `ad.responseInfo`: current load state and diagnostics.
- Events: `statusChange`, `impression`, `clicked`, `paid`, `showed`, `dismissed`.

[Google integration guide](https://developers.google.com/admob/ios/app-open)
