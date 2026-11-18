# SwiftPM runtime smoke test — 2026-11-18

PASS for the checks below on a Simlock-leased iPhone 17 / iOS 27.2 simulator.
Installed the Debug app produced by `build:ios:spm`; served this repository's
example JavaScript with Metro on port 8088. The build includes the documented
Expo 58.0.26 / expo-modules-macros 0.33.0 workaround. Google test ad units only.

| Check | Observed result | Evidence |
| --- | --- | --- |
| Launch and native module registration | Main QA screen rendered; no missing-module error or crash during the run | [Initial state](launch.png) |
| UMP outside-EEA debug flow | `unknown` / `canRequestAds: false` changed to `notRequired` / `true` | [Consent](consent.png) |
| SDK initialization | `initialize()` resolved; `GADMobileAds` adapter reported `ready` | [Metro events](events.log) |
| Banners | Preloaded 338×106, hook-created 338×53, unsubscribed 338×250 test banners rendered inside their cards | [Banners](banners.png) |
| Native ad | `Native card: loaded`; Google test creative rendered; native ad validator reported “No implementation issues found” | [Native ad and validator](native.png) |
| App open | Loaded, presented full screen, closed, then QA UI showed `Dismissed` with Show ad disabled | [Presented ad](app-open.png) |
| Interstitial | Presented, emitted impression/dismissed, returned to QA screen with `status=shown`; `show()` resolved `undefined` | [Presented ad](interstitial.png), [events](events.log) |
| Rewarded | Displayed completion message, emitted `earnedReward coins x10`, then `show()` resolved `{"type":"coins","amount":10}` after close | [Reward completion](rewarded.png), [events](events.log) |
| Not-loaded guard | Immediate show rejected with `code=notLoaded`; no ad appeared | [QA results](guards.png) |
| Single-use guard | Re-showing the used interstitial rejected with `code=alreadyShown` | [QA results](guards.png) |

Relevant Metro output:

```text
00:50:00.380 preloaded interstitial: show() RESOLVED with undefined
00:50:09.266 preloaded rewarded: earnedReward coins x10
00:50:23.647 preloaded rewarded: show() RESOLVED with {"type":"coins","amount":10}
00:50:37.532 fresh (expect notLoaded): show() REJECTED code=notLoaded message=The ad is not ready to show (status: loading). Check isLoaded before calling show().
00:50:39.428 already-shown: show() REJECTED code=alreadyShown message=This ad has already been shown. Full-screen ads are single-use — create a new one.
```

The initial UI showed development warnings about ads preloaded before
`initialize()` (the example intentionally waits for consent), plus the existing
React Native `SafeAreaView` deprecation warning. Dismissing the development
overlay allowed normal QA. The native ad validator's accessibility coordinates
were offset after scrolling; its visible Dismiss button closed the overlay.

This is a runtime smoke test, not the complete checklist in `example/QA.md`.
EEA consent forms, swipeable ads (requires an ad unit), mediation adapters,
rotation, lifecycle stress and four-hour expiry were not exercised. No ad
click-through/install actions were performed. The automation session and Metro
started for this run were closed, and the Simlock lease was released.
