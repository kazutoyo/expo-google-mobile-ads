# Manual QA checklist

Run on both iOS Simulator and Android Emulator.
Use the test App ID / ad unit IDs (never a production ID).

## Basics

- [ ] After launch, the preloaded banner (`largeAnchoredAdaptive`) shows
- [ ] The hook-created banner (`anchoredAdaptive`) shows
- [ ] `anchoredAdaptive` height is 50-90dp, `largeAnchoredAdaptive` is 50-150dp (record the actual values)
- [ ] No layout shift when the ad appears (the space for `ad.size`, the requested size, is reserved before load)
- [ ] **Fits inside its container**: on both platforms, verify visually that the banner does not
      overflow its container's width (e.g. the OPEN button isn't clipped on the side). Record the
      container width (with padding excluded), the ad's requested width, and the resulting height

## Banner sizes

Press "Show the banner size gallery". Each card creates its own ad with `useBannerAd` and draws a
red outline around the box `BannerAdView` reserves, so clipping, letterboxing and overflow are
visible. For every size record: whether it loads and renders, requested size vs `loadedSize`, and
whether it fits its container.

The card's inner width is printed on each card. `FULL_BANNER` (468dp) and `LEADERBOARD` (728dp) are
**wider than a phone screen** — record what actually happens rather than marking it a failure.

- [ ] `BANNER` (320x50)
- [ ] `LARGE_BANNER` (320x100)
- [ ] `MEDIUM_RECTANGLE` (300x250)
- [ ] `FULL_BANNER` (468x60) — wider than the card
- [ ] `LEADERBOARD` (728x90) — wider than the card
- [ ] `inlineAdaptive` with `maxHeight: 100` (the resolved height must not exceed it)
- [ ] `inlineAdaptive` with `maxHeight: 250` (same, at a different max)
- [ ] `anchoredAdaptive` in each of the three orientations (`current` / `portrait` / `landscape`)
- [ ] `largeAnchoredAdaptive` in each of the three orientations

There is no "no `maxHeight`" row any more: `maxHeight` is now required. See
"inlineAdaptive without maxHeight" below for why, and do not add one back.

### `FULL_BANNER` / `LEADERBOARD` on a phone (GMA behaviour, not a bug)

Both load with `loadedSize` equal to the requested size and are then silently clipped by the
card — no error, no downscale, no `loadedSize` correction. Confirmed identical on iOS 26
(iPhone 17) and Android 16 (Pixel 9a) on 2026-08-27. The clipping is **inert**: the reserved
box is clipped by the card's own bounds, the card is not widened, the surrounding layout and
the following cards are positioned exactly as their reserved heights dictate, and the page
never scrolls horizontally. Nothing to fix — worth documenting so a reader doesn't file it.

### `inlineAdaptive` without `maxHeight` (fixed 2026-08-27)

Before the fix, `maxHeight` was optional, and omitting it diverged badly:

| | size helper returned | result |
|---|---|---|
| iOS (iPhone 17) | `338 x 0` | load failed, error code 0, "Invalid ad width or height" |
| Android (Pixel 9a) | `347 x 923` | loaded as a **fixed** 923dp-tall banner |

Both were the same bug: `BannerAdSize` carried only `{width, height}`, so the "inline
adaptive" flag (`GADAdSize.flags` / `AdSize.isInlineAdaptiveBanner`) was dropped and the
native side rebuilt a *fixed* ad size. iOS's no-max-height helper returns height `0` as a
sentinel, Android's returns the whole screen height. `maxHeight` is now required and the
flag now crosses the boundary, so both platforms request a genuine inline adaptive banner of
`width x maxHeight`. Full write-up:
`.superpowers/sdd/2026-08-27-banner-ad-api/inline-adaptive-report.md`.

### The adaptive flag on the rebuilt ad size (fixed 2026-08-27)

`inlineAdaptive` was only half the bug: the same marker was missing for the two *anchored*
adaptive kinds, so those still crossed as bare `{width, height}` and were rebuilt as a fixed
custom size. `inlineAdaptive?: boolean` has been replaced by `adaptiveKind?: BannerAdAdaptiveKind`,
a single discriminator naming the exact factory the size came from — orientation included,
because the anchored factories are per-orientation and return different heights.

The check that matters is not "does it render" (a fixed 338x53 renders the same as an anchored
adaptive 338x53) but "which flag does the rebuilt native ad size carry". Values observed by
instrumenting the size reconstruction, one ad per gallery card:

| `adaptiveKind` | iOS `GADAdSize.flags` | Android `isAnchored` / `isInline` / `isLargeAnchored` |
|---|---|---|
| absent (the 5 fixed sizes) | 0 | false / false / false |
| `anchored`, `anchoredPortrait`, `anchoredLandscape` | 64 | true / false / false |
| `largeAnchored`, `largeAnchoredPortrait`, `largeAnchoredLandscape` | 512 | false / false / true |
| `inline` | 128 | false / true / false |

(Android's `isAnchoredAdaptiveBanner` and `isLargeAnchoredAdaptiveBanner` are separate flags, not
nested: the large variant sets only the second.)

Before the fix every one of those except `inline` rebuilt as a fixed custom size (iOS `flags` 1,
Android all three booleans false). Full write-up:
`.superpowers/sdd/2026-08-27-banner-ad-api/adaptive-flag-report.md`.

Why the orientation is part of the marker: `largeAnchoredLandscape` resolves to **338x80** on the
iPhone 17 (width 338) and **347x82** on the Pixel 9a (width 347), while `largeAnchored` /
`largeAnchoredPortrait` resolve to **338x106** / **347x108**. A three-value marker would have had
to rebuild every anchored size through the current-orientation factory, so an explicitly
landscape size would have been laid out at 80 and requested at 106.

## Reuse (the library's core feature)

- [ ] Switching to screen B and back to screen A shows the preloaded ad again **instantly, with no
      reload** (no new load request should appear in logcat / the iOS console)

## Rotation

- [ ] Rotating the device to landscape updates the hook-created banner's width (`useBannerAdSize`)

## Initialization order

- [ ] Commenting out the `initialize()` call produces a `__DEV__` console warning that it hasn't
      been called
- [ ] Delaying `initialize()` by 5 seconds via `setTimeout` still loads the ad correctly afterward
      (it stays `loading` during the delay, then loads once initialization completes)

## Errors

- [ ] Pressing "Switch to a bad ad unit ID (recreates the ad)" populates `error`, including
      `responseInfo`

## Code-review fixes

- [ ] **Stale state across ad recreation**: rotate the device (the hook-created banner's adaptive
      size changes, so `useBannerAd` builds a new ad). The FIRST `[QA] hook render:` line logged
      after the size changes must already read `isLoaded=false`. Same check after pressing
      "Switch to a bad ad unit ID": the first line after the switch must not carry the old ad's
      `isLoaded=true`, and switching back to the valid unit must not carry the old `error`
- [ ] **Preloaded ad adopts `loadedSize`**: on the unsubscribed card (no `useBannerAdState`
      anywhere), the banner appears and fills the red outline with no letterboxing, even though
      nothing in the app re-renders it
- [ ] **Release with a View still mounted**: pressing "Release the unsubscribed ad while its View
      is mounted" collapses that banner to a 0x0 box and does not crash (before the fix, native
      received shared object id `0` and threw `SharedObject.NotFoundException`)
- [ ] **Unmount during initialization**: set `INITIALIZE_DELAY_MS = 5000`, then press "Hide the
      hook-created banner" before initialization resolves. No crash, and no `load()` on a released
      ad in the logs

## Additional items (verifying recent native fixes)

- [ ] **Real unmount**: pressing "Force-recreate screen A" (changes `key` to fully unmount and
      remount `PreloadedBanner`) doesn't crash. On Android this goes through `OnViewDestroys`. The
      ad is still usable (shows) after being recreated
- [ ] **Two Views for the same ad**: pressing "Add a second View for the same ad" attaches the same
      `ad` to two `BannerAdView`s — the most recently mounted one shows the ad, the first goes
      blank, and a dev warning is logged. Pressing "Remove" afterward should not leave the first
      View permanently broken
- [ ] **Events**: the `impression` event is logged (record whether `clicked` / `paid` can also be
      observed with test ads)

## Run log (2026-08-27, inline adaptive fix)

Both platforms, gallery cards, after the fix. `card inner width` is 338 on the iPhone 17 and
347.43 on the Pixel 9a, which is why the requested widths differ.

| card | iOS 26 / iPhone 17 | Android 16 / Pixel 9a |
|---|---|---|
| `BANNER` | showing, requested 320x50, loadedSize 320x50 | showing, requested 320x50, loadedSize 320x50 |
| `LARGE_BANNER` | showing, 320x100 / 320x100 | showing, 320x100 / 320x100 |
| `MEDIUM_RECTANGLE` | showing, 300x250 / 300x250 | showing, 300x250 / 300x250 |
| `FULL_BANNER` | showing, 468x60 / 468x60, clipped | showing, 468x60 / 468x60, clipped |
| `LEADERBOARD` | showing, 728x90 / 728x90, clipped | showing, 728x90 / 728x90, clipped |
| `inlineAdaptive maxHeight 100` | showing, 338x100 / 338x100 | showing, 347x100 / 347x100 |
| `inlineAdaptive maxHeight 250` | showing, 338x250 / 338x250 | showing, 347x250 / 347x250 |
| preloaded `largeAnchoredAdaptive` | showing, 338x106 / 338x106 | showing, 347x108 / 347x108 |
| hook-created `anchoredAdaptive` | showing, 338x53 | showing, 347x54 |

Note the Google test ad units serve exactly the requested size, so `loadedSize` equalling the
requested max here does not by itself prove the server was free to serve something shorter.

## Run log (2026-08-27, adaptive flag fix)

Re-run of the rows above plus the six new anchored-orientation cards. Every size resolved by the
JS helper was rebuilt natively to **exactly** the same width and height, with the flags in the
table further up.

| card | iOS 26 / iPhone 17 | Android 16 / Pixel 9a |
|---|---|---|
| the 5 fixed sizes | showing, unchanged from the run log above | requested and rebuilt at the same size, flags all false |
| `inlineAdaptive maxHeight 100` | showing, 338x100 / loadedSize 338x100 | rebuilt 347x100, inline flag set |
| `inlineAdaptive maxHeight 250` | showing, 338x250 / loadedSize 338x250 | rebuilt 347x250, inline flag set |
| `anchoredAdaptive (current)` | showing, 338x53 / 338x53 | rebuilt 347x54, anchored flag set |
| `anchoredAdaptive (portrait)` | showing, 338x53 / 338x53 | rebuilt 347x54, anchored flag set |
| `anchoredAdaptive (landscape)` | showing, 338x53 / 338x53 | rebuilt 347x54, anchored flag set |
| `largeAnchoredAdaptive (current)` | showing, 338x106 / 338x106 | rebuilt 347x108, large anchored flag set |
| `largeAnchoredAdaptive (portrait)` | showing, 338x106 / 338x106 | rebuilt 347x108, large anchored flag set |
| `largeAnchoredAdaptive (landscape)` | showing, 338x80 / 338x80 | rebuilt 347x82, large anchored flag set |
| preloaded `largeAnchoredAdaptive` | showing, 338x106 / 338x106 | large anchored flag set |
| hook-created `anchoredAdaptive` | showing, 338x53 | showing (`isLoaded=true`, impression + paid fired), 347x54 |

The unsubscribed `inlineAdaptive maxHeight 250` card is worth a separate note: on iOS the served
ad came back **338x249**, one point shorter than the requested maximum, and `loadedSize` reported
249. That is the ad-size delegate doing its job.

Android caveat, stated rather than glossed over: the Pixel 9a emulator was unstable during this
run (repeated `System UI isn't responding`, `SocketTimeoutException` on the ad requests with all
13 gallery cards mounted at once, and two spontaneous reboots). The Android column above is read
from the instrumented size reconstruction, which covers every card, plus the main screen's
`anchoredAdaptive` banner reaching `isLoaded=true` with an impression. A screenshot of the six
new anchored-orientation cards *rendering* on Android was not obtained. The fixed and inline
rows had already been captured visually in the earlier run log.

## Run log

For each item, record which platform it was run on, the actual result, and (if relevant) the
matching log line in
`.superpowers/sdd/2026-08-27-banner-ad-api/task-12-report.md`.
