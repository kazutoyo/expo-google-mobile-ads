---
title: "API"
description: "Every component, hook, class, method and type exported from the package root."
---

```typescript
import { createBannerAd, BannerAdView, BannerAdSize } from '@kazutoyo/expo-google-mobile-ads';
```

Everything below is exported from the package root and works on both iOS and Android. Platform differences are noted on the individual entries.

## Components

### `BannerAdView`

Type: `React.FC<BannerAdViewProps>`

Displays a banner ad. Attaches the native view on mount and detaches it on unmount **without destroying the ad**, so the same ad can be shown again on another screen.

The view sizes itself from `ad.size` before the ad has loaded, and from `ad.loadedSize` afterwards. The space is reserved at the requested size and only corrects itself if the served ad came back a different size. The view subscribes to the ad directly, so a preloaded ad rendered without any hook still re-renders when it loads.

A released ad renders as a zero-sized box rather than throwing.

#### `BannerAdViewProps`

| Prop | Type | Description |
| --- | --- | --- |
| `ad` | [`BannerAd`](#bannerad) | The ad to display, from [`createBannerAd()`](#createbanneradoptions) or [`useBannerAd()`](#usebanneradoptions). Safe to pass before it has loaded. |
| `style` (optional) | `StyleProp<ViewStyle>` | Applied on top of the width and height the ad's size determines. |

## Hooks

### `useBannerAd(options)`

| Parameter | Type |
| --- | --- |
| `options` | [`BannerAdOptions`](#banneradoptions) |

Creates a banner ad, starts loading it, and **releases it on unmount**. Use this when the ad's lifetime matches the screen's.

A new ad is created when `adUnitId` or `size` changes; the old one is released. `requestOptions` is read only at creation time — changing it afterwards has no effect.

Returns: [`BannerAdState`](#banneradstate) `& { ad: `[`BannerAd`](#bannerad)` }`

### `useBannerAdState(ad)`

| Parameter | Type |
| --- | --- |
| `ad` | [`BannerAd`](#bannerad) |

Subscribes to an ad that already exists — one preloaded with [`createBannerAd()`](#createbanneradoptions), for instance. **Neither creates nor releases it**; the caller owns its lifetime.

The state is keyed on the ad instance, so passing a different ad resets it rather than carrying the previous ad's `isLoaded` and `error` over.

Returns: [`BannerAdState`](#banneradstate)

### `useBannerAdSize(spec)`

| Parameter | Type |
| --- | --- |
| `spec` | [`BannerAdSizeSpec`](#banneradsizespec) |

Recomputes an adaptive size when the screen width or orientation changes. Use it whenever `spec.orientation` is `'current'`, because an anchored adaptive size resolves to a different height in portrait and landscape.

Returns: [`BannerAdSize`](#banneradsize-1)

### `useInterstitialAd(options)`

| Parameter | Type |
| --- | --- |
| `options` | [`FullScreenAdOptions`](#fullscreenadoptions) |

Creates an interstitial ad, starts loading it, and releases it on unmount. `requestOptions` is read only at creation time; call the hook with a different `adUnitId` to get a new ad.

Returns: [`FullScreenAdState`](#fullscreenadstate) `& { ad: `[`InterstitialAd`](#interstitialad)` }`

### `useInterstitialAdState(ad)`

| Parameter | Type |
| --- | --- |
| `ad` | [`InterstitialAd`](#interstitialad) |

Subscribes to an interstitial ad the caller already owns. Neither creates nor releases it. Keyed on the ad instance, like [`useBannerAdState()`](#usebanneradstatead).

Returns: [`FullScreenAdState`](#fullscreenadstate)

### `useRewardedAd(options)`

| Parameter | Type |
| --- | --- |
| `options` | [`FullScreenAdOptions`](#fullscreenadoptions) |

Creates a rewarded ad, starts loading it, and releases it on unmount.

Returns: [`FullScreenAdState`](#fullscreenadstate) `& { ad: `[`RewardedAd`](#rewardedad)` }`

### `useRewardedAdState(ad)`

| Parameter | Type |
| --- | --- |
| `ad` | [`RewardedAd`](#rewardedad) |

Subscribes to a rewarded ad the caller already owns. Neither creates nor releases it.

Reports load state only. What the ad offers is on [`ad.reward`](#rewardedad), and whether the user actually earned it comes solely from what `show()` resolves with. Keeping those apart is what stops a reward being granted to someone who dismissed the ad.

Returns: [`FullScreenAdState`](#fullscreenadstate)

### `useConsentInfo()`

Subscribes to the consent information the SDK last reported.

**Read-only** — calling it requests nothing. Until something calls [`gatherConsent()`](#gatherconsentoptions) or one of the other consent functions, every field holds its "nothing known yet" value.

It does **not** hydrate from the SDK's persisted consent on mount. After an app restart it reports `status: 'unknown'` and `canRequestAds: false`, even though the native SDK still holds `'obtained'`.

A settings screen that decides whether to show a privacy-options button from this hook alone will therefore show nothing after a restart, unless the app already called a consent function during that launch.

Returns: [`ConsentInfo`](#consentinfo)

## Classes

### `BannerAd`

Type: Class extends `SharedObject<`[`BannerAdEvents`](#banneradevents)`>`

A banner ad. Created by [`createBannerAd()`](#createbanneradoptions) or [`useBannerAd()`](#usebanneradoptions), and independent of any view.

#### Properties

| Property | Type | Description |
| --- | --- | --- |
| `size` | [`BannerAdSize`](#banneradsize-1) | Read only. The size that was requested. Used to reserve space before the ad loads. |
| `status` | [`BannerAdStatus`](#banneradstatus) | Read only. Where the ad is in its lifecycle. |
| `error` (optional) | [`AdError`](#aderror) | Read only. Set when `status` is `'error'`. |
| `loadedSize` (optional) | [`BannerAdSize`](#banneradsize-1) | Read only. The size the served ad actually came back as, available once loaded. Carries `adaptiveKind`, so it can be passed straight back into a `size` option without degrading to a fixed size. |
| `responseInfo` (optional) | [`ResponseInfo`](#responseinfo) | Read only. Which ad source and mediation adapter served the ad. |

#### Methods

| Method | Returns | Description |
| --- | --- | --- |
| `load()` | `void` | Requests the ad again. Use it to retry after a failure or to refresh manually. |
| `release()` | `void` | Destroys the native ad. Inherited from `SharedObject`. A released ad can never be loaded or shown again. |
| `addListener(event, listener)` | `EventSubscription` | Subscribes to one of the [`BannerAdEvents`](#banneradevents). Inherited from `SharedObject`. |

### `InterstitialAd`

Type: Class extends `SharedObject<`[`FullScreenAdEvents`](#fullscreenadevents)`>`

A full-screen interstitial ad. **Single-use**: after `show()`, `status` is `'shown'`, which is terminal. `load()` does nothing from there, and both platform SDKs reject a reuse independently (iOS `AdAlreadyUsed`, Android `AD_REUSED`). Create a new ad for the next impression.

#### Properties

| Property | Type | Description |
| --- | --- | --- |
| `status` | [`FullScreenAdStatus`](#fullscreenadstatus) | Read only. |
| `error` (optional) | [`AdError`](#aderror) | Read only. Set when `status` is `'error'`. |
| `responseInfo` (optional) | [`ResponseInfo`](#responseinfo) | Read only. |

#### Methods

| Method | Returns | Description |
| --- | --- | --- |
| `show()` | `Promise<void>` | Presents the ad, resolving when the user dismisses it. Rejects with a [`ShowAdError`](#showaderror). It deliberately does **not** wait for an ad that is still loading. Check `isLoaded` and skip the ad instead. |
| `load()` | `void` | Requests the ad again. Does nothing once `status` is `'shown'`. |
| `release()` | `void` | Destroys the native ad. |
| `addListener(event, listener)` | `EventSubscription` | Subscribes to one of the [`FullScreenAdEvents`](#fullscreenadevents). |

### `RewardedAd`

Type: Class extends `SharedObject<`[`RewardedAdEvents`](#rewardedadevents)`>`

A full-screen rewarded ad. Single-use in the same way as [`InterstitialAd`](#interstitialad).

#### Properties

| Property | Type | Description |
| --- | --- | --- |
| `reward` (optional) | [`AdReward`](#adreward) | Read only. What this ad **offers**, readable as soon as it loads so a prompt can tell the user what they stand to get. **Not evidence the reward was earned.** On iOS it is populated before the ad is ever presented, so treating its presence as "the user watched the ad" would grant the reward to someone who dismissed it immediately. |
| `status` | [`FullScreenAdStatus`](#fullscreenadstatus) | Read only. |
| `error` (optional) | [`AdError`](#aderror) | Read only. |
| `responseInfo` (optional) | [`ResponseInfo`](#responseinfo) | Read only. |

#### Methods

| Method | Returns | Description |
| --- | --- | --- |
| `show()` | `Promise<`[`AdReward`](#adreward)` \| null>` | Presents the ad. Resolves with the reward the user earned, or `null` if they dismissed it without earning one. **This resolved value is the only source of truth for whether a reward was earned.** Grant it here, never from `ad.reward`. Rejects with a [`ShowAdError`](#showaderror). |
| `load()` | `void` | Requests the ad again. Does nothing once `status` is `'shown'`. |
| `release()` | `void` | Destroys the native ad. |
| `addListener(event, listener)` | `EventSubscription` | Subscribes to one of the [`RewardedAdEvents`](#rewardedadevents). |

### `ShowAdError`

Type: Class extends `Error`

Thrown by `show()` on a full-screen ad.

| Property | Type | Description |
| --- | --- | --- |
| `code` | [`ShowAdErrorCode`](#showaderrorcode) | Which of the three failures happened. |
| `cause` (optional) | `unknown` | For `failedToShow`, the error the native side rejected with. Keeps programmatic access to the SDK's own error, for telling iOS's `AdAlreadyUsed` apart from a genuine presentation failure. |

### `ConsentError`

Type: Class extends `Error`

Thrown by every consent function.

| Property | Type | Description |
| --- | --- | --- |
| `code` | [`ConsentErrorCode`](#consenterrorcode) | Normalized across platforms. |
| `cause` (optional) | `unknown` | The original native error. |

The SDK's own numeric code is appended to `message`, because the raw numbers disagree across platforms — code `2` is `invalidAppID` on iOS but `INTERNET_ERROR` on Android.

## Constants

### `BannerAdSize`

An object holding the fixed sizes and the adaptive size helpers.

#### Fixed sizes

| Constant | Size (dp) | Notes |
| --- | --- | --- |
| `BannerAdSize.BANNER` | 320×50 | |
| `BannerAdSize.LARGE_BANNER` | 320×100 | |
| `BannerAdSize.MEDIUM_RECTANGLE` | 300×250 | |
| `BannerAdSize.FULL_BANNER` | 468×60 | Tablet size. On a phone it loads successfully and is then silently clipped — no error, no downscale, no layout warning. |
| `BannerAdSize.LEADERBOARD` | 728×90 | Tablet size, same clipping behaviour as `FULL_BANNER`. |

#### `BannerAdSize.anchoredAdaptive(options?)`

| Parameter | Type |
| --- | --- |
| `options` (optional) | [`AdaptiveOptions`](#adaptiveoptions) |

An anchored adaptive size, 50–90dp tall. Synchronous — it resolves without waiting for a load, so the display area can be reserved ahead of time.

The underlying native API is **deprecated on both platforms** and may be removed in a future SDK major version. It is kept because its shorter height has less impact on layout than `largeAnchoredAdaptive`. It is deliberately not marked `@deprecated` in TypeScript, so using it on purpose does not produce a warning.

Returns: [`BannerAdSize`](#banneradsize-1)

#### `BannerAdSize.largeAnchoredAdaptive(options?)`

| Parameter | Type |
| --- | --- |
| `options` (optional) | [`AdaptiveOptions`](#adaptiveoptions) |

The successor to `anchoredAdaptive`, 50–150dp tall. Stays within 20% of the portrait height, reserving a larger area for when video ad demand is high.

Returns: [`BannerAdSize`](#banneradsize-1)

#### `BannerAdSize.inlineAdaptive(options)`

| Parameter | Type |
| --- | --- |
| `options` | [`InlineAdaptiveOptions`](#inlineadaptiveoptions) |

An inline adaptive size for placement inside scrollable content, up to `options.maxHeight`.

The returned `height` is a **maximum**, not the final height — the served ad may come back shorter, and `ad.loadedSize` reports what actually arrived.

`maxHeight` is required and has no default. Each SDK's "no maximum height" helper returns a value nobody can reserve layout for: iOS returns a height of `0` as a sentinel, Android the full screen height. Any default this function picked would reserve layout the caller never asked for.

There is no `orientation` option either — unlike the anchored sizes, the max-height form of inline adaptive is orientation-independent on both platforms.

Returns: [`BannerAdSize`](#banneradsize-1)

#### `BannerAdSize.resolve(spec)`

| Parameter | Type |
| --- | --- |
| `spec` | [`BannerAdSizeSpec`](#banneradsizespec) |

Resolves a spec object to a size, once. [`useBannerAdSize()`](#usebanneradsizespec) is this plus a subscription to orientation changes.

Returns: [`BannerAdSize`](#banneradsize-1)

## Methods

### `createBannerAd(options)`

| Parameter | Type |
| --- | --- |
| `options` | [`BannerAdOptions`](#banneradoptions) |

Creates a banner ad and starts loading it. No view is involved, so this can be called outside React: at module scope, at app startup, or before a screen transition.

If the SDK has not finished initializing, the load is queued until it has. If initialization fails, the ad moves to `status: 'error'` rather than waiting forever.

The caller owns the ad's lifetime and should call `release()` when done with it.

Returns: [`BannerAd`](#bannerad)

### `createInterstitialAd(options)`

| Parameter | Type |
| --- | --- |
| `options` | [`FullScreenAdOptions`](#fullscreenadoptions) |

Creates an interstitial ad and starts loading it. Single-use — create a new one for each impression.

Returns: [`InterstitialAd`](#interstitialad)

### `createRewardedAd(options)`

| Parameter | Type |
| --- | --- |
| `options` | [`FullScreenAdOptions`](#fullscreenadoptions) |

Creates a rewarded ad and starts loading it. Single-use.

Returns: [`RewardedAd`](#rewardedad)

### `initialize()`

Initializes the Google Mobile Ads SDK. Call it once at app startup, before loading ads.

**This library never initializes itself**, and the ordering against UMP consent is the app's decision.

Google's own guidance on that ordering is not settled. One reading puts consent first, because `initialize()` brings up the mediation adapters. Another allows initializing first, on the grounds that initialization processes no personal data and that policy only requires not *requesting* ads until `canRequestAds` is true. Auto-initializing would pick one of those readings on the app's behalf, with no way to override it.

One thing matters for making that decision: **`initialize()` starts the native SDK, and its mediation adapters, immediately.** The queue described below defers ad *loads* only, not initialization. An app that needs initialization itself to happen after consent has to order the two calls that way. Gating on `canRequestAds` afterwards does not achieve it.

Repeated calls return the same promise. If initialization fails, the cached promise is cleared so a later call can retry, and every ad queued behind it is told that it failed.

Returns: `Promise<`[`InitializationStatus`](#initializationstatus)`>`

### `setRequestConfiguration(config)`

| Parameter | Type |
| --- | --- |
| `config` | [`RequestConfiguration`](#requestconfiguration) |

Sets request-level configuration that applies to every ad request — test devices, child-directed treatment, and the maximum ad content rating.

Returns: `void`

### `gatherConsent(options?)`

| Parameter | Type |
| --- | --- |
| `options` (optional) | [`ConsentRequestOptions`](#consentrequestoptions) |

Requests the latest consent information and shows the consent form if one is required, in a single native call. This is the whole flow for most apps.

Returns: `Promise<`[`ConsentInfo`](#consentinfo)`>`, rejecting with a [`ConsentError`](#consenterror)

### `requestConsentInfoUpdate(options?)`

| Parameter | Type |
| --- | --- |
| `options` (optional) | [`ConsentRequestOptions`](#consentrequestoptions) |

Requests the latest consent information **without** showing a form. Use it only when the form has to be shown at a different moment than the update; otherwise `gatherConsent()` does both.

Returns: `Promise<`[`ConsentInfo`](#consentinfo)`>`

### `showConsentFormIfRequired()`

Shows the consent form only if `status` is `'required'`, resolving without showing anything otherwise. Requires a preceding successful `requestConsentInfoUpdate()`.

Returns: `Promise<`[`ConsentInfo`](#consentinfo)`>`

### `showPrivacyOptionsForm()`

Shows the privacy options form, letting the user change a choice they already made. Offer the entry point that calls this only while `privacyOptionsRequirement` is `'required'`.

Returns: `Promise<`[`ConsentInfo`](#consentinfo)`>`

### `getConsentInfo()`

Reads the current consent information without contacting the network.

Returns: `Promise<`[`ConsentInfo`](#consentinfo)`>`

### `resetConsent()`

Erases the stored consent so the form can be shown again.

**Development builds only**: a no-op when `__DEV__` is false. It is also what makes a device re-testable at all. The SDK persists consent, so without it a device can be walked through the flow once and then never shows the form again short of reinstalling the app.

Returns: `Promise<`[`ConsentInfo`](#consentinfo)`>`

## Types

### `AdaptiveOptions`

| Property | Type | Description |
| --- | --- | --- |
| `width` (optional) | `number` | In dp. Defaults to the screen width. |
| `orientation` (optional) | `'current' \| 'portrait' \| 'landscape'` | Defaults to `'current'`, the orientation at call time. |

### `AdError`

| Property | Type | Description |
| --- | --- | --- |
| `code` | `number` | The SDK's own error code. |
| `message` | `string` | |
| `domain` | `string` | Which SDK layer raised it. |
| `responseInfo` (optional) | [`ResponseInfo`](#responseinfo) | Present when the failure came back with response information. |

### `AdReward`

What the user earned from a rewarded ad.

| Property | Type |
| --- | --- |
| `type` | `string` |
| `amount` | `number` |

### `AdapterResponse`

One mediation adapter's part in filling a request.

| Property | Type | Description |
| --- | --- | --- |
| `adapterClassName` | `string` | |
| `latencyMillis` | `number` | How long this adapter took. |
| `adError` (optional) | `{ code: number; message: string; domain: string }` | Why this adapter did not fill. |

### `BannerAdAdaptiveKind`

Literal type: `'anchored' \| 'anchoredPortrait' \| 'anchoredLandscape' \| 'largeAnchored' \| 'largeAnchoredPortrait' \| 'largeAnchoredLandscape' \| 'inline'`

Marks a size as adaptive, and which family it belongs to.

Both native SDKs represent "adaptive" as a flag on their ad-size type, not as a width and height: `GADAdSize.flags` on iOS, and `AdSize.isAnchoredAdaptiveBanner` / `isInlineAdaptiveBanner` / `isLargeAnchoredAdaptiveBanner` on Android. It cannot be recovered from the two numbers alone.

**This is why an adaptive size must be passed around whole.** Rebuilding one from its `width` and `height` drops the marker, and the native side then requests a fixed banner of exactly that height, with no error to notice.

Orientation is folded into the marker rather than kept separately, because the anchored sizes genuinely differ by orientation. Measured on device, `largeAnchored` is 338×106 where `largeAnchoredLandscape` is 338×80.

### `BannerAdEvents`

| Event | Payload | Description |
| --- | --- | --- |
| `statusChange` | `{ status: `[`BannerAdStatus`](#banneradstatus)`; error?: `[`AdError`](#aderror)` }` | The ad moved through its lifecycle. |
| `impression` | — | The ad recorded an impression. |
| `clicked` | — | The user tapped the ad. |
| `paid` | [`PaidEventValue`](#paideventvalue) | Revenue was attributed to this impression. |

### `BannerAdOptions`

| Property | Type | Description |
| --- | --- | --- |
| `adUnitId` | `string` | The AdMob ad unit ID, slash-separated (`ca-app-pub-xxxx/yyyy`). |
| `size` | [`BannerAdSize`](#banneradsize-1) | A fixed constant or the result of one of the adaptive helpers. |
| `requestOptions` (optional) | [`RequestOptions`](#requestoptions) | Per-request targeting. |

### `BannerAdSize`

| Property | Type | Description |
| --- | --- | --- |
| `width` | `number` | Read only, in dp. |
| `height` | `number` | Read only, in dp. For an `inline` adaptive size this is the **maximum** height, not a fixed one. |
| `adaptiveKind` (optional) | [`BannerAdAdaptiveKind`](#banneradadaptivekind) | Read only. Set by the three adaptive helpers, absent on the fixed sizes. |

### `BannerAdSizeSpec`

Literal type: `union`

A description of an adaptive size that can be re-resolved, for [`useBannerAdSize()`](#usebanneradsizespec).

Acceptable values are: `{ type: 'anchoredAdaptive' } &` [`AdaptiveOptions`](#adaptiveoptions) `|` `{ type: 'largeAnchoredAdaptive' } &` [`AdaptiveOptions`](#adaptiveoptions) `|` `{ type: 'inlineAdaptive' } &` [`InlineAdaptiveOptions`](#inlineadaptiveoptions)

### `BannerAdState`

| Property | Type | Description |
| --- | --- | --- |
| `isLoaded` | `boolean` | |
| `error` (optional) | [`AdError`](#aderror) | |
| `loadedSize` (optional) | [`BannerAdSize`](#banneradsize-1) | The size the served ad came back as. |

A released ad reports `{ isLoaded: false }` rather than throwing, so a component still rendering an ad it just released does not crash.

### `BannerAdStatus`

Literal type: `'loading' \| 'loaded' \| 'error'`

### `ConsentErrorCode`

Literal type: `string`

Why a consent call failed. Normalized on the native side.

| Code | Meaning |
| --- | --- |
| `network` | Network error contacting the consent server. |
| `timeout` | The request timed out. |
| `invalidOperation` | Called out of order — showing a form before an update, for example. |
| `misconfiguration` | **iOS only.** The app ID or the UMP setup in the AdMob console is wrong. |
| `formUnavailable` | **iOS only.** No consent form could be loaded for this user. |
| `internal` | SDK-internal error. On Android this also covers the app's React context having been torn down. |
| `noActivity` | **Android only.** Produced by this library, not the SDK: the call arrived with no Activity in the foreground. |
| `unknown` | Native sent no recognized code. |

Android's UMP has no equivalent of `misconfiguration` or `formUnavailable` and reports those situations as `internal` or `invalidOperation`.

### `ConsentInfo`

`Readonly` — a snapshot of what UMP currently knows. Every consent function resolves with one, and the published snapshot is frozen because it is shared with every `useConsentInfo()` subscriber.

| Property | Type | Description |
| --- | --- | --- |
| `status` | [`ConsentStatus`](#consentstatus) | UMP's own consent status. |
| `canRequestAds` | `boolean` | Whether ads may be requested right now. **Gate on this, not `status`.** It is already `true` for a user whose consent is not required at all, and for one who consented only to the minimum needed to serve ads. |
| `isConsentFormAvailable` | `boolean` | Whether a form can currently be shown. iOS reports three values (`UMPFormStatus`) and Android only a boolean, so this is narrowed to the boolean both can produce; iOS's `unknown` becomes `false`. Nothing an app can do differs between "unknown" and "unavailable". |
| `privacyOptionsRequirement` | [`PrivacyOptionsRequirementStatus`](#privacyoptionsrequirementstatus) | Show your own privacy-options entry point only while this is `'required'`. |

None of the four change according to *which* privacy choice the user made — they describe whether consent is needed and whether ads may be requested, not what was chosen.

### `ConsentRequestOptions`

| Property | Type | Description |
| --- | --- | --- |
| `tagForUnderAgeOfConsent` (optional) | `boolean` | UMP's own flag, **separate** from [`RequestConfiguration.tagForUnderAgeOfConsent`](#requestconfiguration), which GMA uses when requesting ads. Setting one does not set the other, so pass it to both if both apply. |
| `debugSettings.testDeviceIds` (optional) | `string[]` | iOS takes the identifier for vendor, Android a hashed device ID. Both SDKs print the value the device needs to the console or logcat on the first consent request, so run once without this and copy the id out of the log. |
| `debugSettings.geography` (optional) | [`DebugGeography`](#debuggeography) | The region to simulate. |

`debugSettings` only takes effect in debug builds, and only on the listed devices.

### `ConsentStatus`

Literal type: `'unknown' \| 'required' \| 'notRequired' \| 'obtained'`

Whether the user's consent is needed, and whether it has been given. Mirrors UMP's own enum on both platforms.

`'unknown'` is the state before `requestConsentInfoUpdate()` has ever succeeded. It is not an error — nothing has been asked yet.

### `DebugGeography`

Literal type: `'disabled' \| 'eea' \| 'regulatedUsState' \| 'other'`

Which region the SDK should pretend the device is in, for testing consent flows. Applies only to devices listed in `ConsentRequestOptions.debugSettings.testDeviceIds`, and is ignored on every other device on both platforms.

### `FullScreenAdEvents`

| Event | Payload | Description |
| --- | --- | --- |
| `statusChange` | `{ status: `[`FullScreenAdStatus`](#fullscreenadstatus)`; error?: `[`AdError`](#aderror)` }` | |
| `showed` | — | The ad was presented. |
| `dismissed` | — | The user closed the ad. |
| `impression` | — | |
| `clicked` | — | |
| `paid` | [`PaidEventValue`](#paideventvalue) | |

### `FullScreenAdOptions`

| Property | Type | Description |
| --- | --- | --- |
| `adUnitId` | `string` | |
| `requestOptions` (optional) | [`RequestOptions`](#requestoptions) | |

### `FullScreenAdState`

| Property | Type |
| --- | --- |
| `isLoaded` | `boolean` |
| `error` (optional) | [`AdError`](#aderror) |

### `FullScreenAdStatus`

Literal type: `'loading' \| 'loaded' \| 'shown' \| 'error'`

`'shown'` is **terminal**. These ads are one-shot on both SDKs, so a shown ad is never reloaded — create a new one instead.

### `InitializationStatus`

| Property | Type | Description |
| --- | --- | --- |
| `adapterStatuses` | `Record<string, { state: 'ready' \| 'notReady'; description: string; latency: number }>` | One entry per mediation adapter, keyed by class name. |

### `InlineAdaptiveOptions`

| Property | Type | Description |
| --- | --- | --- |
| `width` (optional) | `number` | In dp. Defaults to the screen width. |
| `maxHeight` | `number` | Maximum height in dp. Must be at least 32dp; 50dp or more is recommended. Required — see [`inlineAdaptive()`](#banneradsizeinlineadaptiveoptions) for why there is no meaningful default. |

### `PaidEventValue`

Revenue attributed to a single impression.

| Property | Type | Description |
| --- | --- | --- |
| `value` | `number` | |
| `currencyCode` | `string` | |
| `precision` | `'unknown' \| 'estimated' \| 'publisherProvided' \| 'precise'` | How exact `value` is. |

### `PrivacyOptionsRequirementStatus`

Literal type: `'unknown' \| 'required' \| 'notRequired'`

Whether the app must offer a privacy options entry point in its own settings UI. Show that entry point only while this is `'required'`, and open it with [`showPrivacyOptionsForm()`](#showprivacyoptionsform).

### `RequestConfiguration`

Applies to every ad request. Set it with [`setRequestConfiguration()`](#setrequestconfigurationconfig).

| Property | Type | Description |
| --- | --- | --- |
| `testDeviceIds` (optional) | `string[]` | Devices that receive test ads. |
| `tagForChildDirectedTreatment` (optional) | `boolean` | |
| `tagForUnderAgeOfConsent` (optional) | `boolean` | GMA's flag, separate from the UMP one in [`ConsentRequestOptions`](#consentrequestoptions). |
| `maxAdContentRating` (optional) | `'G' \| 'PG' \| 'T' \| 'MA'` | |

### `RequestOptions`

Per-request targeting, passed when creating an ad.

| Property | Type | Description |
| --- | --- | --- |
| `keywords` (optional) | `string[]` | |
| `contentUrl` (optional) | `string` | The URL of the content the ad appears alongside. |

### `ResponseInfo`

Which ad source filled the request.

| Property | Type | Description |
| --- | --- | --- |
| `responseId` (optional) | `string` | |
| `mediationAdapterClassName` (optional) | `string` | The adapter that won. |
| `adSourceName` (optional) | `string` | |
| `adapterResponses` | [`AdapterResponse[]`](#adapterresponse) | Every adapter that was tried, in order. |

### `RewardedAdEvents`

Everything in [`FullScreenAdEvents`](#fullscreenadevents), plus:

| Event | Payload | Description |
| --- | --- | --- |
| `earnedReward` | [`AdReward`](#adreward) | The user earned the reward. Grant it from `show()`'s resolved value rather than here unless you need the event for analytics. |

### `ShowAdErrorCode`

Literal type: `'notLoaded' \| 'alreadyShown' \| 'failedToShow'`

| Code | Meaning |
| --- | --- |
| `notLoaded` | The ad is not ready. Check `isLoaded` before calling `show()`. Also covers an ad that has been released: it can never be shown again, and it is not `alreadyShown` because releasing an ad says nothing about whether it was ever presented. |
| `alreadyShown` | This ad's `status` is already `'shown'`. |
| `failedToShow` | The SDK itself refused to present it. `cause` carries the SDK's own error. |

`notLoaded` and `alreadyShown` are decided from the ad's own `status` before anything reaches the SDK. Android's Next-Gen SDK has no readiness check at all, so deciding it here is the only way to make both platforms behave identically.
