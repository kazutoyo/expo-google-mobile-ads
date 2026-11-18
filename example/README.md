# Example app

Install dependencies in the repository root and in this directory, then generate
the iOS project:

```sh
cd example
npm ci
npx expo prebuild --platform ios
npm run build:ios:spm
```

`build:ios:spm` converts the generated project to SwiftPM and builds a Debug app
for the generic iOS Simulator destination (arm64 and x86_64), without code signing.
The output is under `ios/build/swiftpm-derived/Build/Products/Debug-iphonesimulator`.
Set `SWIFTPM_DERIVED_DATA` to use a different build directory.

Expo 58.0.26 / expo-modules-macros 0.33.0 need a workaround: the script patches
the installed Expo SwiftPM generator to use Expo's shipped macro executable
instead of compiling the host macro as an iOS dependency, and supplies the macro
compiler flag. It also removes the CocoaPods-only Expo configure phase and old
modules provider references left by `pod deintegrate`. The library itself does
not apply these changes to consuming apps.

The workaround is idempotent and checks dependency versions before changing files.
`npm ci` restores the installed Expo package. Recheck the workaround when upgrading
Expo; the script stops on other versions. Regenerate with `npx expo prebuild
--platform ios --clean` to recreate a CocoaPods project.
