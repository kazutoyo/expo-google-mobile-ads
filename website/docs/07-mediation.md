---
title: "Mediation"
description: "Add mediation adapters through the config plugin's dependency hooks."
---

This library doesn't ship a version-pinned list of mediation adapters. Adapter versions change often, so a list pinned here would go stale. Instead, the config plugin takes the dependencies directly, and you specify the ones you need.

The example below uses AppLovin. The Android artifact coordinate and the iOS pod version are both real, so you can copy them as a starting point.

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

The Android and iOS versions above deliberately differ. The two adapters are versioned independently and are frequently out of step, so **never copy one platform's number onto the other**. Read each from its own changelog.

**Watch for `(In progress)` when you read a changelog.** Google's adapter changelogs list the *next*, unreleased version at the very top, marked `(In progress)`. Taking the topmost number gets you a version that does not exist yet, and `pod install` or Gradle resolution then fails. Take the first entry *below* any `(In progress)` heading.

**Versions move. Don't copy one from here and forget it.** Get the current version from the changelog linked below at the time you add the adapter. For the other networks, use the artifact id (Android) or pod name (iOS) from the table with the version the changelog currently lists.

| network | Android | iOS |
|---|---|---|
| AppLovin | `com.google.ads.mediation:applovin` ([changelog](https://developers.google.com/admob/android/mediation/applovin)) | `GoogleMobileAdsMediationAppLovin` ([changelog](https://developers.google.com/admob/ios/mediation/applovin)) |
| Pangle | `com.google.ads.mediation:pangle` ([changelog](https://developers.google.com/admob/android/mediation/pangle)) | `GoogleMobileAdsMediationPangle` ([changelog](https://developers.google.com/admob/ios/mediation/pangle)) |
| Unity Ads | `com.google.ads.mediation:unity` ([changelog](https://developers.google.com/admob/android/mediation/unity)) | `GoogleMobileAdsMediationUnity` ([changelog](https://developers.google.com/admob/ios/mediation/unity)) |
| ironSource | `com.google.ads.mediation:ironsource` ([changelog](https://developers.google.com/admob/android/mediation/ironsource)) | `GoogleMobileAdsMediationIronSource` ([changelog](https://developers.google.com/admob/ios/mediation/ironsource)) |
| LY Ads Network (formerly LINE Ads Network) | `com.google.ads.mediation:line` ([changelog](https://developers.google.com/admob/android/mediation/line)) | `GoogleMobileAdsMediationLine` ([changelog](https://developers.google.com/admob/ios/mediation/line)) |

`androidMavenRepositories` is only needed when a network requires its own Maven repository (Pangle, for example).
