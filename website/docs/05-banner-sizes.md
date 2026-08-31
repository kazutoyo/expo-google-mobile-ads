---
title: "Choosing a banner size"
description: "Which of the fixed and adaptive sizes to use, and the one rule an adaptive size comes with."
---

```typescript
import { BannerAdSize } from '@kazutoyo/expo-google-mobile-ads';
```

## Fixed sizes

`BANNER` (320×50), `LARGE_BANNER` (320×100) and `MEDIUM_RECTANGLE` (300×250) work on any device.

`FULL_BANNER` (468×60) and `LEADERBOARD` (728×90) are tablet sizes. Requested on a phone they load successfully and are then silently clipped. There is no error, no downscale and no layout warning, and the behaviour is identical on both platforms. If you are not targeting tablets, avoid these two.

## Adaptive sizes

All three helpers are synchronous, so the display area can be reserved before the ad arrives.

| Function | Height | Use it for |
| --- | --- | --- |
| [`largeAnchoredAdaptive(options?)`](/api#banneradsizelargeanchoredadaptiveoptions) | 50–150dp | The default choice for a banner anchored to the top or bottom of a screen. |
| [`anchoredAdaptive(options?)`](/api#banneradsizeanchoredadaptiveoptions) | 50–90dp | The same, when the larger footprint of `largeAnchoredAdaptive` does not fit your layout. Wraps a native API that is deprecated on both platforms. |
| [`inlineAdaptive(options)`](/api#banneradsizeinlineadaptiveoptions) | up to `maxHeight` | A banner inside scrollable content, such as a feed. |

```typescript
const size = BannerAdSize.largeAnchoredAdaptive();
const inline = BannerAdSize.inlineAdaptive({ maxHeight: 200 });
```

### Pass the size around whole

**A size returned by one of the adaptive helpers must be handed on unchanged.** Rebuilding one from its numbers, as in `{ width: size.width, height: 100 }`, drops the [`adaptiveKind`](/api#banneradadaptivekind) marker. The native side then requests a fixed banner of exactly that height. There is no error; the request just stops being adaptive.

### Recompute on rotation

An anchored adaptive size resolves to a different height in portrait and landscape. When `orientation` is `'current'` (the default), recompute the size whenever the device rotates. That is what [`useBannerAdSize()`](/api#usebanneradsizespec) is for.

```typescript
import { useBannerAdSize } from '@kazutoyo/expo-google-mobile-ads';

const size = useBannerAdSize({ type: 'largeAnchoredAdaptive' });
```

### Inline sizes come back shorter

For `inlineAdaptive`, the `height` you get is a **maximum**, not the final height, and the served ad may be shorter. Once loaded, [`ad.loadedSize`](/api#bannerad) reports what actually arrived. It carries `adaptiveKind`, so it can go straight back into a `size` option.

`maxHeight` is required and must be at least 32dp; 50dp or more is recommended.
