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

- [ ] Pressing "Switch hook-created banner to a bad ad unit ID" populates `error`, including
      `responseInfo`

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
