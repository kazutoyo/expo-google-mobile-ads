import ExpoModulesCore

/// The ad objects and the banner view, still on the Expo Modules API 1.0 DSL.
///
/// Kept apart from `ExpoGoogleMobileAdsModule` so both platforms have the same two modules:
/// on Android a 2.0 module runs on a separate runtime and cannot hold any 1.0 DSL. Each item
/// here would stay on 1.0 on iOS anyway:
/// - the view, which 2.0 does not support yet;
/// - `BannerAd`, whose constructor throws: the `@SharedObject` macro in SDK 58 calls a throwing
///   `@JS init` without `try`, so it does not build;
/// - `InterstitialAd` / `RewardedAd`, whose members live on the shared `FullScreenAd` base, which
///   `@SharedObject` does not expose through a subclass.
public final class ExpoGoogleMobileAdsObjectsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoGoogleMobileAdsObjects")

    Class(BannerAd.self) {
      Constructor { (adUnitId: String, size: [String: Any?], requestOptions: [String: Any?]?) throws -> BannerAd in
        try BannerAd(adUnitId: adUnitId, size: size, requestOptions: requestOptions)
      }

      Property("size") { (ad: BannerAd) in ad.requestedSize }
      // status/error/loadedSize/responseInfo are written from BannerViewDelegate callbacks
      // (main thread) and read from the JS side on every React render (a hot path). These
      // used to be synced to the main thread here too via runOnMain (i.e. main.sync), but
      // that can collide with the path where main synchronously interrupts the JS runtime,
      // and it exposes a frequently-called path to however backed-up main happens to be —
      // so it's been replaced with the NSLock inside BannerAd (see the comment on the
      // BannerAd.swift side for details). Nothing here touches main anymore.
      Property("status") { (ad: BannerAd) in ad.status }
      Property("error") { (ad: BannerAd) in ad.error }
      Property("loadedSize") { (ad: BannerAd) in ad.loadedSize }
      Property("responseInfo") { (ad: BannerAd) in ad.responseInfo }

      Function("load") { (ad: BannerAd) in ad.load() }
      // @internal, called only by the JS side's deferred-load helper when initialize() fails.
      Function("markLoadFailed") { (ad: BannerAd, message: String) in ad.markLoadFailed(message) }

      // Note: in this version of expo-modules-core, `EventsDefinition` doesn't conform to
      // `ClassDefinitionElement`, so `Events(...)` can't be used inside `Class(...)` (only
      // inside `View(...)`). `SharedObject`'s `emit(event:payload:)` doesn't require
      // pre-registering event names, so JS-side `addListener("statusChange" | "impression" |
      // "clicked" | "paid", ...)` keeps working fine as-is.
    }

    Class("InterstitialAd", FullScreenInterstitialAd.self) {
      Constructor { (adUnitId: String, requestOptions: [String: Any?]?) -> FullScreenInterstitialAd in
        FullScreenInterstitialAd(adUnitId: adUnitId, requestOptions: requestOptions)
      }

      Property("status") { (ad: FullScreenInterstitialAd) in ad.status }
      Property("error") { (ad: FullScreenInterstitialAd) in ad.error }
      Property("responseInfo") { (ad: FullScreenInterstitialAd) in ad.responseInfo }

      Function("load") { (ad: FullScreenInterstitialAd) in ad.load() }
      // @internal, called only by the JS side's deferred-load helper when initialize() fails.
      Function("markLoadFailed") { (ad: FullScreenInterstitialAd, message: String) in
        ad.markLoadFailed(message)
      }
      // Takes the promise rather than being `async`, because it is settled later by a delegate
      // callback (dismissal or presentation failure), not by this function returning.
      AsyncFunction("showAsync") { (ad: FullScreenInterstitialAd, promise: Promise) in
        ad.showAsync(promise)
      }
    }

    Class("AppOpenAd", FullScreenAppOpenAd.self) {
      Constructor { (adUnitId: String, requestOptions: [String: Any?]?) -> FullScreenAppOpenAd in
        FullScreenAppOpenAd(adUnitId: adUnitId, requestOptions: requestOptions)
      }

      Property("status") { (ad: FullScreenAppOpenAd) in ad.appOpenStatus }
      Property("error") { (ad: FullScreenAppOpenAd) in ad.error }
      Property("responseInfo") { (ad: FullScreenAppOpenAd) in ad.responseInfo }

      Function("load") { (ad: FullScreenAppOpenAd) in ad.load() }
      Function("markLoadFailed") { (ad: FullScreenAppOpenAd, message: String) in
        ad.markLoadFailed(message)
      }
      AsyncFunction("showAsync") { (ad: FullScreenAppOpenAd, promise: Promise) in
        ad.showAsync(promise)
      }
    }

    Class("RewardedAd", FullScreenRewardedAd.self) {
      Constructor { (adUnitId: String, requestOptions: [String: Any?]?) -> FullScreenRewardedAd in
        FullScreenRewardedAd(adUnitId: adUnitId, requestOptions: requestOptions)
      }

      Property("status") { (ad: FullScreenRewardedAd) in ad.status }
      Property("error") { (ad: FullScreenRewardedAd) in ad.error }
      Property("responseInfo") { (ad: FullScreenRewardedAd) in ad.responseInfo }
      // What the ad offers, readable before it is shown. Not a signal that anything was earned —
      // see the latch comment in RewardedAd.swift.
      Property("reward") { (ad: FullScreenRewardedAd) in ad.reward }

      Function("load") { (ad: FullScreenRewardedAd) in ad.load() }
      Function("markLoadFailed") { (ad: FullScreenRewardedAd, message: String) in
        ad.markLoadFailed(message)
      }
      AsyncFunction("showAsync") { (ad: FullScreenRewardedAd, promise: Promise) in
        ad.showAsync(promise)
      }
    }

    Class("SwipeableInterstitialAd", EmbeddedSwipeableInterstitialAd.self) {
      Constructor { (adUnitId: String, size: [String: Double]?, maxScreenHoldDuration: Double,
                     requestOptions: [String: Any?]?) -> EmbeddedSwipeableInterstitialAd in
        EmbeddedSwipeableInterstitialAd(adUnitId: adUnitId, size: size,
          maxScreenHoldDuration: maxScreenHoldDuration, requestOptions: requestOptions)
      }
      Property("status") { (ad: EmbeddedSwipeableInterstitialAd) in ad.status }
      Property("error") { (ad: EmbeddedSwipeableInterstitialAd) in ad.error }
      Property("responseInfo") { (ad: EmbeddedSwipeableInterstitialAd) in ad.responseInfo }
      Property("minScreenHoldDuration") { (ad: EmbeddedSwipeableInterstitialAd) in ad.minScreenHoldDuration }
      Function("load") { (ad: EmbeddedSwipeableInterstitialAd) in ad.load() }
      Function("markLoadFailed") { (ad: EmbeddedSwipeableInterstitialAd, message: String) in
        ad.markLoadFailed(message)
      }
    }

    View(SwipeableInterstitialAdView.self) {
      Prop("ad") { (view: SwipeableInterstitialAdView, ad: EmbeddedSwipeableInterstitialAd?) in
        view.setAd(ad)
      }
    }
    Class("RewardedInterstitialAd", FullScreenRewardedInterstitialAd.self) {
      Constructor { (adUnitId: String, requestOptions: [String: Any?]?) -> FullScreenRewardedInterstitialAd in
        FullScreenRewardedInterstitialAd(adUnitId: adUnitId, requestOptions: requestOptions)
      }

      Property("status") { (ad: FullScreenRewardedInterstitialAd) in ad.status }
      Property("error") { (ad: FullScreenRewardedInterstitialAd) in ad.error }
      Property("responseInfo") { (ad: FullScreenRewardedInterstitialAd) in ad.responseInfo }
      Property("reward") { (ad: FullScreenRewardedInterstitialAd) in ad.reward }

      Function("load") { (ad: FullScreenRewardedInterstitialAd) in ad.load() }
      Function("markLoadFailed") { (ad: FullScreenRewardedInterstitialAd, message: String) in
        ad.markLoadFailed(message)
      }
      AsyncFunction("showAsync") { (ad: FullScreenRewardedInterstitialAd, promise: Promise) in
        ad.showAsync(promise)
      }
    }

    Class("NativeAd", NativeAdObject.self) {
      Constructor { (adUnitId: String, requestOptions: [String: Any?]?) in
        NativeAdObject(adUnitId: adUnitId, requestOptions: requestOptions)
      }
      Property("status") { (ad: NativeAdObject) in ad.value("status") as? String ?? "loading" }
      Property("error") { (ad: NativeAdObject) in ad.value("error") as? [String: Any?] }
      Property("responseInfo") { (ad: NativeAdObject) in ad.value("responseInfo") as? [String: Any?] }
      Property("assets") { (ad: NativeAdObject) in ad.value("assets") as? [String: Any?] }
      Function("load") { (ad: NativeAdObject) in ad.load() }
      Function("markLoadFailed") { (ad: NativeAdObject, message: String) in ad.markLoadFailed(message) }
    }
    View(NativeAdCardView.self) {
      ViewName("NativeAdView")
      Prop("ad") { (view: NativeAdCardView, ad: NativeAdObject?) in view.setAd(ad) }
    }

    View(BannerAdView.self) {
      Prop("ad") { (view: BannerAdView, ad: BannerAd?) in
        view.setAd(ad)
      }
    }
  }
}
