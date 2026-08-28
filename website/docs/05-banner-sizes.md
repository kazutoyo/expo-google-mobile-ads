---
title: "BannerAdSize"
description: "Fixed and adaptive banner sizes, and why an adaptive size must be passed around whole."
---

```typescript
import { BannerAdSize } from '@kazutoyo/expo-google-mobile-ads';
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
import { useBannerAdSize } from '@kazutoyo/expo-google-mobile-ads';

const size = useBannerAdSize({ type: 'largeAnchoredAdaptive' });
```

## inlineAdaptive

`inlineAdaptive({ width?, maxHeight })` takes a **required** `maxHeight` and no `orientation` option:

```typescript
const size = BannerAdSize.inlineAdaptive({ maxHeight: 200 });
```

`inlineAdaptive` sets `adaptiveKind: 'inline'` on the size it returns — see above for why the size must be passed around whole.

`maxHeight` has no default on purpose. Each SDK's "no max height" helper returns a value nobody can reserve layout for: iOS's returns a height of `0` as a sentinel, and Android's returns the full screen height. Any default this function picked would be an arbitrary layout reservation you never asked for — so it asks you instead. `maxHeight` must be at least 32dp; 50dp or more is recommended. There's no `orientation` option either: unlike the anchored sizes, the max-height form of inline adaptive is orientation-independent on both platforms.

The returned `height` is a **maximum**, not the final height — the served ad may come back shorter. `ad.loadedSize` reports what actually arrived once the ad loads, and it carries `adaptiveKind` too, so it can be passed straight back into `useBannerAd`'s `size` option without silently degrading to a fixed size.
