---
title: "Installation"
description: "Install the package, add the config plugin, and pass your AdMob App IDs."
---

```sh
npx expo install @kazutoyo/expo-google-mobile-ads
```

This module contains native code, so **it does not run in Expo Go**. You need a development build: `npx expo run:ios` / `npx expo run:android` locally, or `eas build --profile development`. Adding the package to a project running in Expo Go fails at `requireNativeModule` with a message about the module not being found. That is not a bug in the library.

## Swift Package Manager (iOS)

The npm package includes a `Package.swift` for Expo SDK 58's SwiftPM integration
(currently in preview). In an app already using that integration, Expo autolinking
builds `ExpoGoogleMobileAds` from source and resolves Google Mobile Ads SDK
`13.12.0..<14.0.0` and UMP `3.0.0..<4.0.0` through Google's official Swift packages.
The manifest requires Swift 6.2 or later; use an Xcode version supported by your Expo SDK.

The example's full SwiftPM Debug build is verified for arm64 and x86_64 iOS
Simulator with Xcode 27.2, Expo 58.0.26 and expo-modules-macros 0.33.0. These Expo
versions require a workaround: the example uses Expo's shipped macro executable
instead of building the host macro as an iOS dependency, and removes CocoaPods-only
Expo project entries after migration. See the [example build instructions](https://github.com/kazutoyo/expo-google-mobile-ads/blob/main/example/README.md).
The library does not automatically patch Expo in consuming apps; without the
workaround, these Expo versions fail in `ExpoModulesMacrosCore` when loading
SwiftSyntax. CocoaPods remains available.

After installing the npm package, refresh the app's SwiftPM graph from the app root:

```sh
node node_modules/react-native/scripts/setup-apple-spm.js update
```

Keep the config plugin below: it supplies the AdMob App ID and measurement settings
in both CocoaPods and SwiftPM apps. Rebuild the native app after updating the graph.
The manifest depends on `ExpoModulesCoreHeaders`, which Expo generates during
autolinking, so use it through Expo rather than adding this repository directly
in Xcode's Add Package Dependencies dialog.

The `iosPods` mediation option adds CocoaPods dependencies only. For a SwiftPM app,
add adapters using each ad network's SwiftPM instructions. CocoaPods installation
continues to work with the existing podspec.

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

The plugin writes these App IDs into the native projects. After changing them, regenerate with `npx expo prebuild`, then rebuild with `npx expo run:ios` / `npx expo run:android` or a fresh EAS build. Use `npx expo prebuild --clean` only when you intend to delete and recreate the native projects; it removes manual changes in `ios/` and `android/`. `prebuild` alone installs nothing on the device, and a JavaScript reload does not regenerate or rebuild the native projects.

The plugin validates the presence and format of the App IDs at build time. If an ID is missing, or if an ad **unit** ID (slash-separated, like `ca-app-pub-xxxx/yyyy`) is passed where an App ID belongs, the build fails immediately with a message that explains why. An App ID uses the tilde-separated form: `ca-app-pub-xxxxxxxxxxxxxxxx~xxxxxxxxxx`.

The two are easy to mix up. Left unchecked, the mistake turns into an opaque crash on iOS or an exception on Android, deep inside the Google SDK.

Passing `delayAppMeasurementInit: true` writes a setting on both platforms that delays sending measurement data until UMP consent has been collected (see [Consent (UMP)](/consent)).
