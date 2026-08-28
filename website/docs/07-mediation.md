---
title: "Mediation"
description: "Add mediation adapters through the config plugin's dependency hooks."
---

This library doesn't ship a version-pinned "curated list" of mediation adapters. Adapter versions change often, and pinning them here would just become stale maintenance debt. Instead, the config plugin exposes raw hooks for the dependencies, and you specify what you need yourself.

The example below uses AppLovin as a fully worked reference — a real, current Android artifact coordinate and iOS pod version you can copy as a starting point.

```json
{
  "expo": {
    "plugins": [
      [
        "@kazutoyo/expo-google-mobile-ads",
        {
          "androidAppId": "ca-app-pub-xxxx~yyyy",
          "iosAppId": "ca-app-pub-xxxx~zzzz",
          "androidDependencies": [
            "com.google.ads.mediation:applovin:13.6.4.0"
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
