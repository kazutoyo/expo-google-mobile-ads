---
title: "Installation"
description: "Install the package, add the config plugin, and pass your AdMob App IDs."
---

```sh
npx expo install @kazutoyo/expo-google-mobile-ads
```

This module contains native code, so **it does not run in Expo Go**. You need a development build: `npx expo run:ios` / `npx expo run:android` locally, or `eas build --profile development`. Adding the package to a project running in Expo Go fails at `requireNativeModule` with a message about the module not being found. That is not a bug in the library.

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

The plugin writes these App IDs into the native projects. After changing them, the native projects have to be regenerated *and* rebuilt: run `npx expo prebuild --clean`, then `npx expo run:ios` / `npx expo run:android` or a fresh EAS build. `prebuild` on its own only rewrites the projects and installs nothing on the device, and a JavaScript reload does neither.

The plugin validates the presence and format of the App IDs at build time. If an ID is missing, or if an ad **unit** ID (slash-separated, like `ca-app-pub-xxxx/yyyy`) is passed where an App ID belongs, the build fails immediately with a message that explains why. An App ID uses the tilde-separated form: `ca-app-pub-xxxxxxxxxxxxxxxx~xxxxxxxxxx`.

The two are easy to mix up. Left unchecked, the mistake turns into an opaque crash on iOS or an exception on Android, deep inside the Google SDK.

Passing `delayAppMeasurementInit: true` writes a setting on both platforms that delays sending measurement data until UMP consent has been collected (see [Consent (UMP)](/consent)).
