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
- [ ] `inlineAdaptive` with no `maxHeight`
- [ ] `inlineAdaptive` with `maxHeight: 100` (the resolved height must not exceed it)

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

## Run log

For each item, record which platform it was run on, the actual result, and (if relevant) the
matching log line in
`.superpowers/sdd/2026-08-27-banner-ad-api/task-12-report.md`.
