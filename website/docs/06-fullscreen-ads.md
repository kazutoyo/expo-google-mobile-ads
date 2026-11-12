---
title: "Interstitial and rewarded ads"
description: "Single-use full-screen ads: shown rather than rendered, and what counts as an earned reward."
---

Full-screen ads have no view. They are created and shown, not rendered.

`createInterstitialAd({ adUnitId, requestOptions })` and `createRewardedAd({ adUnitId, requestOptions })` return `SharedObject`s that start loading right away, queued until `initialize()` completes just like a banner. Like `createBannerAd`, they can be created outside React: at app startup, or before a screen transition.

```typescript
import { createInterstitialAd, createRewardedAd } from '@kazutoyo/expo-google-mobile-ads';

export const interstitialAd = createInterstitialAd({
  adUnitId: 'ca-app-pub-3940256099942544/1033173712',
});

export const rewardedAd = createRewardedAd({
  adUnitId: 'ca-app-pub-3940256099942544/5224354917',
});
```

## Hooks

The same ownership split as the [banner hooks](/banner-ads), one pair per ad type:

| hook | creates the ad | releases it on unmount |
|---|---|---|
| `useInterstitialAd(options)` | yes | **yes** |
| `useInterstitialAdState(ad)` | no (subscribes to an existing `ad`) | **no** |
| `useRewardedAd(options)` | yes | **yes** |
| `useRewardedAdState(ad)` | no (subscribes to an existing `ad`) | **no** |

```tsx
import { useInterstitialAd } from '@kazutoyo/expo-google-mobile-ads';

function Screen() {
  const { ad, isLoaded } = useInterstitialAd({
    adUnitId: 'ca-app-pub-3940256099942544/1033173712',
  });

  return (
    <Button
      title="Show ad"
      disabled={!isLoaded}
      // `show()` rejects with a ShowAdError; an unhandled one is a crash in dev.
      onPress={() => ad.show().catch((error) => console.warn(error))}
    />
  );
}
```

To watch a preloaded ad's state (`interstitialAd` above, for example), use `useInterstitialAdState` / `useRewardedAdState` instead. Neither creates nor releases the `ad` passed to it, so the caller owns its lifetime.

## Single-use

A full-screen ad can be shown once. After `show()`, `status` becomes `'shown'`, which is **terminal**: calling `load()` on it does nothing. Both platform SDKs enforce this independently of this library (iOS reports `AdAlreadyUsed`, Android `AD_REUSED`), so there is no way around it. Create a new ad with `createInterstitialAd` / `createRewardedAd` for the next impression.

## `show()`

```typescript
show(): Promise<void>;             // InterstitialAd
show(): Promise<AdReward | null>;  // RewardedAd
```

Resolves when the user dismisses the ad. For a rewarded ad, it resolves with the `AdReward` the user earned, or `null` if they dismissed it without earning one.

It rejects with a `ShowAdError` whose `code` is one of:

- `notLoaded` — the ad isn't ready. Check `isLoaded` before calling `show()`.
- `alreadyShown` — this ad's `status` is already `'shown'`.
- `failedToShow` — the SDK itself refused to present it.

**`show()` deliberately does not wait for an ad that is still loading.** Showing a full-screen ad "as soon as it finishes loading" can interrupt a user who has since moved on to something else, which is what Google's own policy guidance warns against. Check `isLoaded` and skip the ad if it isn't ready, rather than queuing a `show()` call behind the load.

## `ad.reward` is not proof anything was earned

A `RewardedAd`'s `reward` property is what the ad **offers**. It is readable as soon as the ad loads, before it has ever been shown, so a prompt can tell the user what they stand to get. **It is not evidence the reward was earned.** On iOS in particular, the underlying value is populated before the ad is ever presented, so treating its mere presence as "the user watched the ad" would grant the reward to someone who dismissed it immediately.

**The only source of truth for whether a reward was earned is the value `show()` resolves with.** Grant the reward there, never from `ad.reward`.

```typescript
try {
  const reward = await rewardedAd.show(); // AdReward | null
  if (reward) {
    // grant `reward.amount` of `reward.type`
  }
} catch (error) {
  // ShowAdError — the ad could not be presented. Carry on without the reward.
}
```
