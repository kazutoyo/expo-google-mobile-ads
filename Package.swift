// swift-tools-version: 6.2
import PackageDescription

// Expo's SwiftPM autolinker builds this manifest through
// direct/@kazutoyo/expo-google-mobile-ads. The headers package is generated next
// to the scope directory and supplies Expo's interfaces and Swift macros.
let package = Package(
  name: "expo-google-mobile-ads",
  platforms: [.iOS("16.4")],
  products: [
    .library(name: "ExpoGoogleMobileAds", targets: ["ExpoGoogleMobileAds"])
  ],
  dependencies: [
    .package(path: "../../ExpoModulesCoreHeaders"),
    .package(
      url: "https://github.com/googleads/swift-package-manager-google-mobile-ads.git",
      "13.12.0"..<"14.0.0"
    ),
    .package(
      url: "https://github.com/googleads/swift-package-manager-google-user-messaging-platform.git",
      "3.0.0"..<"4.0.0"
    ),
  ],
  targets: [
    .target(
      name: "ExpoGoogleMobileAds",
      dependencies: [
        .product(name: "ExpoModulesCoreHeaders", package: "ExpoModulesCoreHeaders"),
        .product(name: "GoogleMobileAds", package: "swift-package-manager-google-mobile-ads"),
        .product(
          name: "GoogleUserMessagingPlatform",
          package: "swift-package-manager-google-user-messaging-platform"
        ),
      ],
      path: "ios",
      exclude: ["ExpoGoogleMobileAds.podspec"]
    )
  ],
  swiftLanguageModes: [.v5]
)
