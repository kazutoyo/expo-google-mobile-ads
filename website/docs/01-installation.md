---
title: "Installation"
description: "Install the package, add the config plugin, and pass your AdMob App IDs."
---

```sh
npx expo install @kazutoyo/expo-google-mobile-ads
```

This module contains native code, so **it does not run in Expo Go**. You need a development
build: `npx expo run:ios` / `npx expo run:android` locally, or `eas build --profile development`.
Adding the package to a project running in Expo Go fails at `requireNativeModule` with a message
about the module not being found, which reads like a bug in the library and is not one.

The config plugin below writes your App IDs into the native projects, so after changing it the
native projects have to be regenerated *and* rebuilt: `npx expo prebuild --clean` followed by
`npx expo run:ios` / `npx expo run:android`, or a fresh EAS build. `prebuild` on its own only
rewrites the projects — it installs nothing on the device — and a JavaScript reload does neither.

## Config plugin

Pass your AdMob App IDs to the plugin's config in `app.json` (or `app.config.js`).

```json
{
  "expo": {
    "plugins": [
      [
        "@kazutoyo/expo-google-mobile-ads",
        {
          "androidAppId": "ca-app-pub-3940256099942544~3347511713",
          "iosAppId": "ca-app-pub-3940256099942544~1458002511"
        }
      ]
    ]
  }
}
```

The plugin validates the presence and format of the App IDs at build time. If an ID is missing, or if an ad **unit** ID (slash-separated, like `ca-app-pub-xxxx/yyyy`) is passed where an App ID belongs, the build fails immediately with a message that explains why. An App ID uses the tilde-separated form: `ca-app-pub-xxxxxxxxxxxxxxxx~xxxxxxxxxx`. This mix-up is the single most common mistake AdMob newcomers make, and left unchecked it turns into an opaque crash on iOS or exception on Android, deep inside the Google SDK.

Passing `delayAppMeasurementInit: true` writes a setting on both platforms that delays sending measurement data until UMP consent has been collected (see the [Consent (UMP)](/consent) page).
