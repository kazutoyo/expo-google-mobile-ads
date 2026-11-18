# Swipeable interstitial validation

Validated on 2026-11-18 using devices leased through simlock. Metro ran on a dedicated port (8083); other sessions' dev servers and devices were not changed.

## iOS simulator

- iPhone 17, iOS 27.2; Google Mobile Ads SDK 13.12.
- Installed the Debug simulator build and loaded the example from Metro.
- Gathered consent outside the EEA; `canRequestAds` became true and initialization completed.
- Requested `/21775744923/example/swipeable-interstitial`, the SDK's example ad unit. The SDK returned a creative with a visible **Test mode** label.
- Confirmed the native creative filled the modal and the hook reported `Loaded (hold: 0s)`.
- Reloaded the mounted ad and observed `loading` followed by `loaded` and a native `impression` callback.
- Closed and reopened the modal, creating a new ad. Observed another impression.
- Confirmed closing the modal calls `release()`; accessing the released object's native `status` getter throws the expected shared-object-not-found error.
- Used an invalid ad unit (`ca-app-pub-3940256099942544/0000000000`): the hook received `status: error`, error code 1, domain `com.google.admob`, and `Publisher data not found`.
- Opened and immediately closed while a request was pending. After the late result, the object remained released and the app continued running.

Lifecycle observations used temporary debugger instrumentation, which is not shipped in the package. Screen inspection used simlock screenshots. Expo's runtime tap/type commands invoke React handlers; these checks do not establish physical gesture handling.

## Android emulator

- Pixel 9, Android 16 / API 36; ads-mobile-sdk 1.6.0.
- Installed the Debug APK and connected it to the dedicated Metro server.
- Gathered consent, initialized the SDK and opened the swipeable interstitial modal using the same example ad unit.
- Confirmed the native ad reached `loaded`, returned response information and `minScreenHoldDuration: 0`, and rendered a creative across the modal.
- The original Pixel 9 run hit an input-dispatch ANR before entering the swipeable page and became unresponsive again during reload; the emulator OS diagnostic service also timed out. Restarting allowed an initial creative to display. These observations do not establish the cause of the full-sample responsiveness issue.
- A fresh Pixel 8 / API 36 with a temporary entry point containing only this format loaded successfully. Reload returned to `loaded` and increased the observed impression count from 1 to 2.
- On Pixel 8, the real Android Back key closed the modal, called `release()` and left the native status getter inaccessible as expected. An invalid unit produced `status: error`, SDK error code 2 and HTTP 400.
- The temporary isolated entry point and debugger instrumentation were removed after validation; the normal example entry point is restored.
- Expo agent CLI could not select the Android inspector target reliably with both platforms connected. Runtime observations used the example app's explicit Metro CDP target instead. Native screenshots came through simlock.

## Automated checks

- After integrating the latest main (including App Open and Native ads): 24 Jest suites, 249 tests passed (`npm test -- --runInBand --watchman=false`). Watchman was disabled because the machine's Watchman binary references a missing Homebrew library.
- Package/plugin typechecks, example typecheck and package build passed.
- ESLint: zero errors; 20 existing warnings.
- Documentation check and static build passed.
- Package dry-run confirmed the new JavaScript/native files are included and tests are excluded.
- iOS simulator application build passed for arm64 and x86_64.
- Android `:app:assembleDebug` passed against ads-mobile-sdk 1.6.0. After the main merge, the module compile and native Kotlin unit tests passed again.
- After the main merge, all 3 native Swift expiry regression tests passed.

## Remaining coverage

Nonzero hold requirements, paid events, click overlays and app-supplied swipe gestures have not been exercised. The wrapper exposes the required hold duration; the host app remains responsible for enforcing it.
