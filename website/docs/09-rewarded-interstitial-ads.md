---
title: Rewarded interstitial ads
---

# Rewarded interstitial ads

Gather consent and call `initialize()` before loading ads.

```tsx
import { useEventListener } from 'expo';
import { Platform } from 'react-native';
import { useRewardedInterstitialAd } from '@kazutoyo/expo-google-mobile-ads';

const adUnitId = Platform.select({
  android: 'ca-app-pub-3940256099942544/5354046379',
  ios: 'ca-app-pub-3940256099942544/6978759866',
})!;

const { ad, isLoaded, error } = useRewardedInterstitialAd({ adUnitId });
// Subscribe before showing; grant only from this event, including late mediated callbacks.
useEventListener(ad, 'earnedReward', (reward) => grantReward(reward));
// Call from your introduction screen's continue action, only when ready.
if (isLoaded) {
  await ad.show(); // Dismissal; do not grant a second reward from the returned value.
}
```

Before showing, your app must display an introduction that explains the reward and lets the user skip the ad. Call `show()` only after that screen. The library does not provide the introduction UI.

`ad.reward` describes the offered reward, not an earned reward. Grant rewards only from the `earnedReward` event subscribed before presentation. Do not also grant from `show()`'s returned value.

`show()` resolves on dismissal with the reward received by that point, or `null`. An iOS mediated SDK may deliver its reward callback after dismissal; `null` is therefore not a final no-reward verdict for mediation. Keep the ad and reward subscription alive for the adapter's callback, rather than releasing them just because `show()` resolved. Validate callback ordering with the adapters you use. See [Google's iOS rewarded FAQ](https://developers.google.com/admob/ios/rewarded#faq) for the underlying ordering caveat.

Ads are single-use. Server-side verification (SSV) is not yet exposed.

## API

- `createRewardedInterstitialAd({ adUnitId, requestOptions? })`: preload outside React; call `release()` when finished.
- `useRewardedInterstitialAd(options)`: creates and releases the ad; `requestOptions` is read at creation time.
- `useRewardedInterstitialAdState(ad)`: subscribes without owning or releasing the ad.
- `ad.load()`: retry or reload before presentation.
- `ad.status`, `ad.error`, `ad.responseInfo`: current load state and diagnostics.
- Events: `statusChange`, `impression`, `clicked`, `paid`, `showed`, `dismissed`, `earnedReward`.

[Google integration guide](https://developers.google.com/admob/ios/rewarded-interstitial)
