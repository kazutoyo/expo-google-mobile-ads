# Manual QA checklist

Run on both iOS Simulator and Android Emulator.
Use the test App ID / ad unit IDs (never a production ID).

## UMP consent

The consent flow must run before ad initialization: `gatherConsent()` first, then
`initialize()` only if the result's `canRequestAds` is `true`. The example wires this up in
`ConsentSection`, rendered above the ad sections; its "Gather consent" buttons are what starts
`initialize()` (see `beginInitializationOnce` in `App.tsx`) — so items in the sections below now
depend on completing one of items 1-8 here first.

- [ ] 1. Immediately after launch, `useConsentInfo()` shows `status: unknown`,
      `canRequestAds: false`, and `privacyOptionsRequirement: unknown`, and the "Privacy
      options" button does **not** appear
- [ ] 2. "Gather consent (EEA debug)" shows the consent form (if it doesn't appear, add the test
      device ID printed in the log to `testDeviceIds` and retry)
- [ ] 3. Consenting sets `status: obtained` and `canRequestAds: true`; `initialize()` then
      succeeds and ads load
- [ ] 4. Restarting the app resets `useConsentInfo()` to `status: unknown` (it does not hydrate
      from the SDK's persisted consent on mount) — then tapping "Gather consent (EEA debug)"
      again returns `status: obtained` **with no form shown**, proving the native-side consent
      survived the restart even though the hook's on-screen value did not
- [ ] 5. The "Privacy options" button appears only when `privacyOptionsRequirement: required`
- [ ] 6. "Privacy options" reopens the form, and choosing either option there resolves without
      error (none of `useConsentInfo()`'s fields are expected to change based on which choice
      was made — they report whether consent is needed, not what was chosen)
- [ ] 7. **Makes items 2-6 repeatable**: after "Reset consent (dev only)", item 2's form appears
      again (without this, a device can only be walked through the flow once, since the SDK
      persists consent)
- [ ] 8. "Gather consent (outside EEA)" shows no form; `status` becomes `notRequired` and
      `canRequestAds: true`
- [ ] 9. **Error-code normalization**: with Airplane Mode on, "Gather consent (EEA debug)"
      produces an error whose text starts with `network:` on **both iOS and Android**, even
      though the underlying native codes differ (iOS 3, Android 2) — confirming they normalize
      to the same `ConsentErrorCode`. The message ends with `(native code: N)`. Run this on both
      platforms; record the actual `(native code: N)` seen on each
- [ ] 10. **Not reachable from this example app**: `noActivity` only occurs on a consent call
      issued before any Activity has ever existed (a preload-time condition), not on a call made
      after backgrounding an app that already has one — React Native's `currentActivity` isn't
      nulled by `onPause`, so a background-then-tap does not reproduce it here. Do not spend time
      trying to trigger this from the UI; it would need a consent call from module-scope code
      (like the ad-preload path) to be reachable at all

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
`width x maxHeight`. The measurements above are the finding; they were taken by logging the
rebuilt native ad size on both platforms with and without the marker.

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
Android all three booleans false). The flag table above is the full record of that run — it was
produced by instrumenting `makeAdSize` / `makeAdaptiveAdSize` on both platforms and reading the
flags off the reconstructed size, one ad per gallery card.

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

## Full-screen ads (interstitial / rewarded)

Press "Show the full-screen ad QA screen". Every button below maps to one item. Each ad's `status`
is on screen, the rewarded cards also show the **offered** reward, and every event and promise
settlement is appended to the on-screen log and to the console (`adb logcat -v time` on Android;
on iOS these lines do **not** reach the system log, so the Metro console is the only timestamped
record — see the note at the end).

Full-screen ads are **single-use**: after `show()` the status is `'shown'` and stays there. An ad
can therefore be used for exactly one of these items. To get fresh ads:

- the two `use…Ad` ads are recreated by leaving this screen and coming back,
- the module-scope ads (`preloaded …`, `overlap`) are recreated by restarting the app.

Run the items in the order given — several of them depend on the ad reaching `shown` first.

- [ ] 1. **A preloaded interstitial presents and `show()` resolves on dismissal.** "Show preloaded
      interstitial" → the ad appears; on close, `show() RESOLVED with undefined`.
- [ ] 2. **`status` goes `loading` → `loaded` → `shown`.** The two hook-created cards show
      `loading` → `loaded` on mount; any ad shows `→ shown` when presented.
- [ ] 3. **`show()` on a still-loading ad rejects `notLoaded` without presenting anything.** "Show
      an ad that is still loading" creates an ad and shows it in the same tick. Nothing must appear
      on screen.
- [ ] 4. **`show()` on an already-shown ad rejects `alreadyShown`.** Run item 1 first, then "Show
      the preloaded interstitial again".
- [ ] 5. **A rewarded ad watched to completion resolves `{type, amount}` and emits `earnedReward`.**
- [ ] 6. **`ad.reward` is readable before showing, and is labelled as *offered*, not earned.** The
      rewarded cards read it during render; it is `none yet` until the ad loads.
- [ ] 7. **`showed`, `dismissed`, `impression`, `clicked` and `paid` all arrive.** `clicked` needs a
      tap on the ad creative, which leaves the app — come back and close the ad.
- [ ] 8. **`load()` on a shown ad is a no-op.** "load() on the shown interstitial" logs the status
      before and 3 s after: both must read `shown`, with the same `responseId` and no `statusChange`.
- [ ] 9. **An ad created before `initialize()` resolves still loads.** Set `INITIALIZE_DELAY_MS =
      5000` in `App.tsx` and restart the app. The module-scope ads are created first (a `__DEV__`
      warning per ad), and must reach `loaded` after `initialize() resolved`.
- [ ] 10. **Backgrounding the app with an ad on screen does not wedge the promise.** Show an ad,
      press Home, return. `show()` must settle.

### Guard cases that only a deliberate setup reaches

- [ ] A. **A rewarded ad dismissed without earning resolves `null`.** Google's test creative grants
      the reward ~8 s in and blocks dismissal until then, so this cannot be raced. It needs a
      **temporary instrumented build**: comment out `_didEarnReward = true` in
      `ios/RewardedAd.swift` / `earnedReward.set(earned)` in `android/…/RewardedAd.kt`, rebuild,
      watch a rewarded ad to the end, and confirm `show()` resolves `null` even though
      `earnedReward` fired. **Revert and rebuild afterwards**, and confirm the reward comes back.
- [ ] B. **An overlapping load result is discarded, never recorded.** "Overlapping load during a
      presentation" starts two loads 150 ms apart and presents the ad the instant one lands, so the
      other request settles either just before or during the presentation. Which guard catches it
      depends on delivery order — `isStaleLoadResult` if the first request's result arrives after
      the second `load()` superseded it, `shouldDiscardLoadResult` if a result arrives while the ad
      is on screen — and both log which at debug level (`Discarding a stale load result: …` /
      `Discarding a load result: …`). Either way: the presenting ad must still dismiss, `show()`
      must still resolve, the events must still arrive, and `status` must stay `shown` with an
      unchanged `responseId` and no further `statusChange`.
- [ ] C. **A presentation failure rejects instead of hanging, and does not disturb `status`.** Two
      routes:
      - "show() twice in one tick": both calls pass the JS `status === 'loaded'` gate, so the second
        reaches native and is rejected as "already presenting" → `failedToShow`, with `message`
        "This ad is already being presented." byte-identical on both platforms. The first must
        still resolve on dismissal. The button is disabled until the hook interstitial is loaded —
        on an unloaded ad `assertShowable` rejects *both* calls with `notLoaded` before either
        reaches native, which looks like a failure of this item but is really the JS guard doing
        its job. **Check the message, not just the code**: only "This ad is already being
        presented." evidences the native path; "The ad is not ready to show (status: …)" means the
        ad was not loaded and the item was not exercised.
      - "Force an SDK presentation failure on a shown ad": calls the internal `showAsync()` on an
        already-shown ad, bypassing the JS guard, so the SDK itself refuses it
        (`AdAlreadyUsed` / `AD_REUSED`). **`status` must stay `shown`** — no `status -> error` line
        and no `statusChange` — because the ad is still single-use and `load()`'s terminal guard
        must still refuse it.
- [ ] D. **iOS reports the real native rejection message, byte-identical to Android for the same
      failure.** Before this was fixed, every native rejection from `showAsync()` arrived in JS as
      `… undefined reason (at ExpoModulesCore/Promise.swift:65)` — `ShowAdError.code` was right, but
      `message` was useless (`notLoaded` / `alreadyShown` are unaffected; they are built in JS). A
      custom `Exception` subclass on iOS (`AdException` in `ios/FullScreenAd.swift`) now carries the
      SDK's own text. Check it with the double-`show()` button: both platforms must log the same
      `message`, "This ad is already being presented."
- [ ] E. **A forced `showAsync()` on an already-shown ad does not walk `status` from `shown` to
      `error`.** Before this was fixed, `handleFailToPresent` / `handleFailedToShow` recorded the
      presentation failure unconditionally, so calling the `@internal` `showAsync()` on an
      already-shown ad (not reachable through the public `show()`, which rejects `alreadyShown`
      first) parked the ad on `error` — and `load()`'s terminal guard only tests `status == "shown"`,
      so that ad could then be reloaded and shown a second time. Both callbacks now discard the
      whole record when `status` is already `shown` (the same check as guard case C's second route
      above).

### Run log (2026-08-28, full-screen ads)

iOS 26 / iPhone 17 simulator and Android 16 / Pixel 9a emulator, Google test ad units.
Full write-up: `.superpowers/sdd/2026-08-28-fullscreen-ads/task-8-report.md`.

| # | iOS | Android |
|---|---|---|
| 1 | PASS — resolved `undefined` on close | PASS |
| 2 | PASS | PASS |
| 3 | PASS — `notLoaded`, nothing presented | PASS |
| 4 | PASS — `alreadyShown` | PASS |
| 5 | PASS — `{"type":"coins","amount":10}` + `earnedReward` | PASS |
| 6 | PASS — `coins x10` before show, `none yet` while loading | PASS |
| 7 | PASS — all five | PASS — all five |
| 8 | PASS — `shown` → `shown`, same `responseId` | PASS |
| 9 | PASS | PASS |
| 10 | PASS — ad stayed up, resolved on close | PASS — SDK dismissed the ad, promise resolved |
| A | PASS (instrumented) — resolved `null` | PASS (instrumented) — resolved `null` |
| B | PASS | PASS |
| C | PASS both routes | PASS both routes |

This run surfaced two findings, both fixed in `71630e3` and re-verified since — see checklist items
D and E above.

## Run log

For each item, record which platform it was run on, the actual result, and (if relevant) the
matching `adb logcat` / Xcode console line that evidences it. Paste the line into this file —
don't reference a scratch file outside the repository, which nobody cloning it can read.
