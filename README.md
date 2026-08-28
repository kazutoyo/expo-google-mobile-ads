# expo-google-mobile-ads

*(English | [日本語](./README.ja.md))*

An Expo Modules native wrapper for the [Google Mobile Ads (AdMob)](https://developers.google.com/admob) SDK. Currently supports banner ads only.

## Why this library

The existing `react-native-google-mobile-ads` targets React Native (TurboModules) and still carries Old Architecture compatibility baggage. The biggest cost of that: **ads can't be preloaded** — an ad can only be created together with the view that displays it.

This library is built on the Expo Modules API (`SharedObject`), with the ad instance and the display view deliberately kept separate.

- **Preloadable** — `createBannerAd()` can be called outside React, before a screen transition or at app startup. Loading starts immediately; the view can be attached later.
- **Reusable across screens** — `<BannerAdView ad={ad} />` **only detaches, never destroys**, the ad on unmount. The same ad instance can be shown again on a different screen.
- **Hooks-based** — from React, `useBannerAd` / `useBannerAdState` are thin wrappers, nothing more.
- **No layout shift** — `BannerAdSize` computes sizes with a synchronous function that doesn't wait for a load, so the display area can be reserved before the ad arrives.

Android uses the [GMA Next-Gen SDK](https://developers.google.com/admob/android/next-gen/quick-start); iOS uses the Google Mobile Ads SDK v13.

## Scope

- **New Architecture only.** Old Architecture is not supported.
- **Expo SDK 57+** — declared as a `peerDependencies` constraint, so npm/yarn surfaces a
  mismatched install instead of failing later in the native build.
- **iOS 16.4+**, **Android minSdk 24+**. The iOS floor comes from Expo itself
  (`ExpoModulesCore` declares `:ios => '16.4'` from SDK 56 on), not from the ads SDK — Google
  Mobile Ads SDK v13 only needs iOS 13. An app whose `ios.deploymentTarget` is lower than 16.4
  cannot install this pod.
- Banner ads only (phase 1)

Not yet supported (future phases):

- UMP (consent management) — designed separately in phase 2
- Interstitial / rewarded / app open / native ads — phase 3

## Installation

```sh
npx expo install expo-google-mobile-ads
```

### Config plugin

Pass your AdMob App IDs to the plugin's config in `app.json` (or `app.config.js`).

```json
{
  "expo": {
    "plugins": [
      [
        "expo-google-mobile-ads",
        {
          "androidAppId": "ca-app-pub-3940256099942544~3347511713",
          "iosAppId": "ca-app-pub-3940256099942544~1458002511"
        }
      ]
    ]
  }
}
```

The plugin validates the presence and format of the App IDs at build time. If an ID is missing, or if an ad **unit** ID (slash-separated, like `ca-app-pub-xxxx/yyyy`) is passed where an App ID belongs, the build fails immediately with a message that explains why. An App ID uses the tilde-separated form: `ca-app-pub-xxxxxxxxxxxxxxxx~xxxxxxxxxx`. This mix-up is the single most common mistake AdMob newcomers make, and left unchecked it turns into an opaque crash on iOS or exception on Android, deep inside the Google SDK.

Passing `delayAppMeasurementInit: true` writes a setting on both platforms that delays sending measurement data until UMP consent has been collected (groundwork for phase 2's UMP support).

## Initializing the SDK

Call `initialize()` once at app startup, before loading any ads.

```typescript
import { initialize } from 'expo-google-mobile-ads';

await initialize();
```

**This library never initializes itself.** The call is always explicit.

The reason: Google's own guidance on the ordering of initialization versus UMP consent has shifted over time. The older guidance said consent must come first, because `initialize()` triggers ad preloading by mediation adapters; current guidance says initializing first is fine, since initialization itself doesn't process personal data and staying policy-compliant only requires not requesting ads until `canRequestAds()` is true. This is a decision that can carry legal weight for an app, and if the native side auto-initialized, the library would be silently picking one of these shifting interpretations for you, with no way for the app to override it. **The app decides this ordering, not the library.**

Calling `createBannerAd()` before `initialize()` has been called is not an error — loading is queued internally until initialization completes. But if `initialize()` is never called at all, the ad stays `loading` forever. To catch that early, creating an ad while `initialize()` hasn't run yet logs a `__DEV__` warning.

## Preloading

Creating an ad instance (which starts loading) and displaying it on screen are independent. You can create an ad before a screen transition, or at app startup.

```typescript
// e.g. at module scope, or anywhere before a screen transition
import { createBannerAd, BannerAdSize } from 'expo-google-mobile-ads';

export const homeBannerAd = createBannerAd({
  adUnitId: 'ca-app-pub-3940256099942544/9214589741',
  size: BannerAdSize.BANNER,
});
```

```tsx
// in the screen component
import { useBannerAdState, BannerAdView } from 'expo-google-mobile-ads';
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
import { useBannerAd, BannerAdSize, BannerAdView } from 'expo-google-mobile-ads';

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

## BannerAdSize

```typescript
import { BannerAdSize } from 'expo-google-mobile-ads';
```

Fixed sizes:

| constant | size (dp) |
|---|---|
| `BannerAdSize.BANNER` | 320×50 |
| `BannerAdSize.LARGE_BANNER` | 320×100 |
| `BannerAdSize.MEDIUM_RECTANGLE` | 300×250 |
| `BannerAdSize.FULL_BANNER` | 468×60 |
| `BannerAdSize.LEADERBOARD` | 728×90 |

`FULL_BANNER` and `LEADERBOARD` are tablet sizes. Requested on a phone, they load successfully and are then silently clipped — no error, no downscale, no layout warning, identical on both platforms. The container is not widened to fit them, following content keeps its normally reserved height, and there's no horizontal scrolling to reveal the rest. If you're not targeting tablets, avoid these two.

Adaptive sizes (all synchronous functions — they resolve without waiting for a load, so the display area can be reserved ahead of time):

| function | height range | notes |
|---|---|---|
| `BannerAdSize.anchoredAdaptive(options?)` | 50–90dp | The underlying native API (both Android and iOS) is **deprecated**. It may be removed in a future SDK major version. |
| `BannerAdSize.largeAnchoredAdaptive(options?)` | 50–150dp | The successor to `anchoredAdaptive`. Stays within 20% of portrait height, reserving a larger area for when video ad demand is high. |
| `BannerAdSize.inlineAdaptive(options)` | up to `options.maxHeight` | For placement inside scrollable content (e.g. a feed). The served ad may be shorter than `maxHeight` — see below. |

All three adaptive helpers tag the returned size with `adaptiveKind: BannerAdAdaptiveKind` — `'anchored' | 'anchoredPortrait' | 'anchoredLandscape' | 'largeAnchored' | 'largeAnchoredPortrait' | 'largeAnchoredLandscape' | 'inline'`, exported from the package root. Both native SDKs represent "adaptive" as a flag on their ad-size type (`GADAdSize.flags` on iOS; `AdSize.isAnchoredAdaptiveBanner` / `isInlineAdaptiveBanner` / `isLargeAnchoredAdaptiveBanner` on Android), not as a width/height value, so it can't be recovered from the two numbers alone. This field replaces an earlier `inlineAdaptive?: boolean` that only covered the inline case: an **anchored** adaptive size crossing the JS boundary as a bare `{ width, height }` was rebuilt natively as a fixed custom request of exactly that size, and the ad silently stopped being adaptive — nothing observable from the app caught it. `adaptiveKind` covers all three families.

Orientation is folded into the marker rather than kept as a separate field, because the anchored sizes genuinely differ by orientation — measured on device, `largeAnchoredLandscape` is 338×80 where `largeAnchored` is 338×106. Collapsing to three kinds (dropping orientation) would force the native side to reconstruct the size through the current-orientation factory, reintroducing the same silent-mismatch bug this field exists to close.

**A `BannerAdSize` produced by any of the three adaptive helpers must be passed around whole.** Reconstructing one from its `width` and `height` — e.g. `{ width: size.width, height: 100 }` — drops `adaptiveKind`, and the native side rebuilds the size as a fixed banner of exactly that height. There's no error; the request just silently stops being adaptive.

`anchoredAdaptive` wraps a deprecated native API, and that's intentional. Its shorter height has less impact on layout, so it's kept as an option for when you want to avoid `largeAnchoredAdaptive`'s larger footprint. It isn't marked `@deprecated` in TypeScript, so it doesn't throw an unwanted warning at anyone using it on purpose.

`options` for `anchoredAdaptive` / `largeAnchoredAdaptive` is `{ width?: number; orientation?: 'current' | 'portrait' | 'landscape' }` (defaults to screen width and `'current'`). To recompute the size when the device rotates, use the `useBannerAdSize(spec)` hook.

```typescript
import { useBannerAdSize } from 'expo-google-mobile-ads';

const size = useBannerAdSize({ type: 'largeAnchoredAdaptive' });
```

### inlineAdaptive

`inlineAdaptive({ width?, maxHeight })` takes a **required** `maxHeight` and no `orientation` option:

```typescript
const size = BannerAdSize.inlineAdaptive({ maxHeight: 200 });
```

`inlineAdaptive` sets `adaptiveKind: 'inline'` on the size it returns — see above for why the size must be passed around whole.

`maxHeight` has no default on purpose. Each SDK's "no max height" helper returns a value nobody can reserve layout for: iOS's returns a height of `0` as a sentinel, and Android's returns the full screen height. Any default this function picked would be an arbitrary layout reservation you never asked for — so it asks you instead. `maxHeight` must be at least 32dp; 50dp or more is recommended. There's no `orientation` option either: unlike the anchored sizes, the max-height form of inline adaptive is orientation-independent on both platforms.

The returned `height` is a **maximum**, not the final height — the served ad may come back shorter. `ad.loadedSize` reports what actually arrived once the ad loads, and it carries `adaptiveKind` too, so it can be passed straight back into `useBannerAd`'s `size` option without silently degrading to a fixed size.

## Mediation

This library doesn't ship a version-pinned "curated list" of mediation adapters. Adapter versions change often, and pinning them here would just become stale maintenance debt. Instead, the config plugin exposes raw hooks for the dependencies, and you specify what you need yourself.

The example below uses AppLovin as a fully worked reference — a real, current Android artifact coordinate and iOS pod version you can copy as a starting point.

```json
{
  "expo": {
    "plugins": [
      [
        "expo-google-mobile-ads",
        {
          "androidAppId": "ca-app-pub-xxxx~yyyy",
          "iosAppId": "ca-app-pub-xxxx~zzzz",
          "androidDependencies": [
            "com.google.ads.mediation:applovin:13.6.4.0"
          ],
          "androidMavenRepositories": [
            "https://artifact.bytedance.com/repository/pangle/"
          ],
          "iosPods": {
            "GoogleMobileAdsMediationAppLovin": "13.6.3.0"
          }
        }
      ]
    ]
  }
}
```

Note that the Android and iOS versions above deliberately differ. The two adapters are versioned
independently and are frequently out of step, so **never copy one platform's number onto the
other**. Read each from its own changelog.

**Watch for "(In progress)" when you read a changelog.** Google's adapter changelogs list the
*next*, unreleased version at the very top, marked `(In progress)`. Taking the topmost number
gets you a version that does not exist yet, and `pod install` / Gradle resolution fails. Take the
first entry *below* any `(In progress)` heading.

**Versions move — don't copy one from here and forget it.** Get the current version for any network from its changelog, linked below, at the time you add it. For the other networks, add the matching artifact id (Android) or pod name (iOS) from the table with the version the changelog currently lists.

| network | Android | iOS |
|---|---|---|
| AppLovin | `com.google.ads.mediation:applovin` ([changelog](https://developers.google.com/admob/android/mediation/applovin)) | `GoogleMobileAdsMediationAppLovin` ([changelog](https://developers.google.com/admob/ios/mediation/applovin)) |
| Pangle | `com.google.ads.mediation:pangle` ([changelog](https://developers.google.com/admob/android/mediation/pangle)) | `GoogleMobileAdsMediationPangle` ([changelog](https://developers.google.com/admob/ios/mediation/pangle)) |
| Unity Ads | `com.google.ads.mediation:unity` ([changelog](https://developers.google.com/admob/android/mediation/unity)) | `GoogleMobileAdsMediationUnity` ([changelog](https://developers.google.com/admob/ios/mediation/unity)) |
| ironSource | `com.google.ads.mediation:ironsource` ([changelog](https://developers.google.com/admob/android/mediation/ironsource)) | `GoogleMobileAdsMediationIronSource` ([changelog](https://developers.google.com/admob/ios/mediation/ironsource)) |
| LY Ads Network (formerly LINE Ads Network) | `com.google.ads.mediation:line` ([changelog](https://developers.google.com/admob/android/mediation/line)) | `GoogleMobileAdsMediationLine` ([changelog](https://developers.google.com/admob/ios/mediation/line)) |

`androidMavenRepositories` is only needed when a network requires its own Maven repository (e.g. Pangle).

## Banner auto-refresh

GMA's banner auto-refresh is **a setting in the AdMob console (per ad unit), not an SDK API**. This library has nothing to do with it. To change the refresh interval, use the AdMob console.

## API reference

Everything exported from `src/index.ts`:

```typescript
// Banner ads (imperative core)
export function createBannerAd(options: BannerAdOptions): BannerAd;
export type { BannerAd, BannerAdOptions, BannerAdEvents };

// Display view
export function BannerAdView(props: BannerAdViewProps): JSX.Element;
export type { BannerAdViewProps };

// Size utilities
export const BannerAdSize: { ... };
export type { AdaptiveOptions, BannerAdAdaptiveKind, BannerAdSizeSpec, InlineAdaptiveOptions };

// Initialization
export function initialize(): Promise<InitializationStatus>;
export function setRequestConfiguration(config: RequestConfiguration): void;

// hooks
export function useBannerAd(options: BannerAdOptions): BannerAdState & { ad: BannerAd };
export function useBannerAdState(ad: BannerAd): BannerAdState;
export type { BannerAdState };
export function useBannerAdSize(spec: BannerAdSizeSpec): BannerAdSize;

// types
export type {
  AdError,
  AdapterResponse,
  BannerAdStatus,
  InitializationStatus,
  PaidEventValue,
  RequestConfiguration,
  RequestOptions,
  ResponseInfo,
};
```

## License

MIT
