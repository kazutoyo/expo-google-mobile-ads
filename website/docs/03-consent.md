---
title: "Consent (UMP)"
description: "Collect UMP consent before requesting any ads, and gate on canRequestAds."
---

The Google User Messaging Platform (UMP) SDK collects the consent (GDPR in the EEA, and equivalent regimes elsewhere) that decides whether your app may request ads at all. Run it before `initialize()` — until you know `canRequestAds`, nothing else about ad loading is safe to do.

```typescript
import { gatherConsent, initialize } from '@kazutoyo/expo-google-mobile-ads';

const { canRequestAds } = await gatherConsent();
if (canRequestAds) await initialize();
```

**Gate on `canRequestAds`, not `status`.** `canRequestAds` is already `true` for a user whose consent isn't required at all (e.g. outside the EEA), and for one who has consented only to the minimum needed to serve ads — `status` alone can't tell you either of those.

## Functions

All six resolve with a `ConsentInfo` snapshot and reject with a `ConsentError` (`code: ConsentErrorCode`, see below).

```typescript
function gatherConsent(options?: ConsentRequestOptions): Promise<ConsentInfo>;
function requestConsentInfoUpdate(options?: ConsentRequestOptions): Promise<ConsentInfo>;
function showConsentFormIfRequired(): Promise<ConsentInfo>;
function showPrivacyOptionsForm(): Promise<ConsentInfo>;
function getConsentInfo(): Promise<ConsentInfo>;
function resetConsent(): Promise<ConsentInfo>;
```

- `gatherConsent(options?)` — requests the latest consent info and shows the form if one is required, in a single native call. This is the flow shown above.
- `requestConsentInfoUpdate(options?)` — requests the latest consent info without showing a form. Use this only when the form needs to be shown at a different moment than the update; otherwise `gatherConsent()` does both.
- `showConsentFormIfRequired()` — shows the form only if `status` is `'required'`, resolving without showing anything otherwise. Requires a preceding successful `requestConsentInfoUpdate()`.
- `showPrivacyOptionsForm()` — shows the privacy options form so the user can change a choice they already made. Only offer this while `privacyOptionsRequirement` is `'required'`.
- `getConsentInfo()` — reads the current consent info without contacting the network.
- `resetConsent()` — erases the stored consent so the form can be shown again. **Development builds only** — a no-op when `__DEV__` is false.

## `useConsentInfo()`

```tsx
import { useConsentInfo, showPrivacyOptionsForm } from '@kazutoyo/expo-google-mobile-ads';

function PrivacySettingsRow() {
  const { privacyOptionsRequirement } = useConsentInfo();
  if (privacyOptionsRequirement !== 'required') return null;
  return <Button title="Privacy options" onPress={() => showPrivacyOptionsForm()} />;
}
```

`useConsentInfo()` is read-only — it never calls the SDK itself, only subscribes to the result of the last consent call something in your app made.

**It does not hydrate from the SDK's persisted consent on mount.** After an app restart, `useConsentInfo()` reports `status: 'unknown'` and `canRequestAds: false` — even though the native SDK still holds `'obtained'` — until something calls a consent function. This is deliberate: the hook never triggers an SDK call on its own, and the startup flow above isn't affected by it, since `gatherConsent()` runs at launch anyway. But **a settings screen that shows its "Privacy options" button from `useConsentInfo()` alone will show nothing after a restart**, unless the app already called `gatherConsent()` (or `getConsentInfo()`) earlier that launch.

Also note: none of `ConsentInfo`'s four fields change according to *which* privacy choice the user made — they describe whether consent is needed and whether ads may be requested, not what was chosen. Don't expect `useConsentInfo()` to reflect a personalization toggle.

## Types

`ConsentInfo` — what every consent function resolves with:

| field | type | meaning |
|---|---|---|
| `status` | `'unknown' \| 'required' \| 'notRequired' \| 'obtained'` | UMP's own consent status. `'unknown'` means no consent call has ever succeeded |
| `canRequestAds` | `boolean` | Whether ads may be requested right now — gate on this, not `status` |
| `isConsentFormAvailable` | `boolean` | Whether a form can currently be shown |
| `privacyOptionsRequirement` | `'unknown' \| 'required' \| 'notRequired'` | Show your own privacy-options entry point only while this is `'required'` |

`ConsentRequestOptions` — passed to `gatherConsent()` / `requestConsentInfoUpdate()`:

| field | type | meaning |
|---|---|---|
| `tagForUnderAgeOfConsent?` | `boolean` | UMP's own flag — separate from `RequestConfiguration.tagForUnderAgeOfConsent`; set both if both apply |
| `debugSettings?.testDeviceIds?` | `string[]` | Devices that receive `debugSettings.geography`. See "Testing" below |
| `debugSettings?.geography?` | `'disabled' \| 'eea' \| 'regulatedUsState' \| 'other'` | Region to simulate — ignored on any device not listed in `testDeviceIds` |

`ConsentErrorCode` — `ConsentError.code`:

| code | meaning |
|---|---|
| `network` | Network error contacting the consent server |
| `timeout` | The request timed out |
| `invalidOperation` | Called out of order (e.g. showing a form before an update) |
| `misconfiguration` | **iOS only** — the app ID or the UMP setup in the AdMob console is wrong |
| `formUnavailable` | **iOS only** — no consent form could be loaded for this user |
| `internal` | SDK-internal error. On Android, also covers the app's React context having been torn down |
| `noActivity` | **Android only** — the call arrived with no Activity in the foreground |
| `unknown` | Anything native didn't send a recognized code for |

## Testing

Force a region with `debugSettings.geography` to reproduce the EEA flow on a device that isn't actually in the EEA — it only takes effect on devices listed in `testDeviceIds`:

```typescript
await gatherConsent({
  debugSettings: { geography: 'eea', testDeviceIds: ['<your test device id>'] },
});
```

Both SDKs print the id the current device needs to console (iOS) / logcat (Android) the first time you call a consent function — run once without `testDeviceIds`, copy the printed id out of the log, and add it.

`resetConsent()` is **development-only**, and it's what makes a device re-testable at all: the SDK persists consent, so without calling it a device can be walked through the flow once and then never shows the form again short of reinstalling the app.

## Platform differences

- `isConsentFormAvailable` narrows iOS's three-valued `UMPFormStatus` (`unknown` / `available` / `unavailable`) to the boolean Android reports — iOS's `unknown` is reported as `false`.
- `misconfiguration` and `formUnavailable` only ever occur on iOS.
- `noActivity` only ever occurs on Android.
- Every consent function is `async` on both platforms — iOS's `UMPConsentInformation` is main-thread-only down to its property getters.
