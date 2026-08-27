import ExpoModulesCore
import GoogleMobileAds

/// Explicitly calls `MobileAds.shared.start()` on the main thread (`@MainActor`). GMA's
/// headers don't explicitly document this method as main-thread-only, but GMA is
/// conventionally initialized from the main thread, and making sure of it costs only a single
/// hop inside an async function, so hop to main without hesitation. `initializeAsync` is
/// already an `AsyncFunction` (async), so this actor hop is effectively free.
@MainActor
private func startMobileAdsSDK() async -> InitializationStatus {
  await MobileAds.shared.start()
}

public final class ExpoGoogleMobileAdsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoGoogleMobileAds")

    AsyncFunction("initializeAsync") { () async -> [String: Any] in
      let status = await startMobileAdsSDK()
      let adapterStatuses = status.adapterStatusesByClassName.mapValues { value in
        [
          "state": value.state == .ready ? "ready" : "notReady",
          "description": value.description,
          "latency": Int(value.latency * 1000),
        ]
      }
      return ["adapterStatuses": adapterStatuses]
    }

    // A synchronous `Function` with no return value, so there's no reason to hold up the
    // calling thread (the JS thread) waiting for main to finish. Just dispatches to
    // `DispatchQueue.main.async`, same as `load()` (a synchronous Function body runs while
    // holding the JS runtime, so calling `main.sync` from there can deadlock in principle —
    // see the comment on `runOnMain` in BannerAd.swift for details). The reason to move it to
    // main at all is that GMA conventionally expects main-thread initialization.
    //
    // **On ordering**: GMA expects `requestConfiguration` (particularly
    // `testDeviceIdentifiers`) to be set before `start()`. Making this async doesn't break
    // that. As long as JS calls setRequestConfiguration → initializeAsync in that order, the
    // point at which each gets "queued onto the main queue" lines up in this order:
    //   E: the `DispatchQueue.main.async` below — queued while JS's synchronous call is still
    //      in progress, so it's already on the main queue by the time
    //      `setRequestConfiguration` returns to JS.
    //   M: the actor hop for `initializeAsync` → `await startMobileAdsSDK()` (`@MainActor`).
    //      This is only queued once `initializeAsync`'s body starts running and reaches the
    //      await, which happens after JS calls `initializeAsync` at the earliest — i.e.
    //      necessarily after E.
    // Since the main queue is FIFO, E runs before M, so `start()` always runs with
    // configuration already applied. This argument doesn't depend on which queue
    // `initializeAsync`'s body itself runs on (even if the body happened to run on main, that
    // execution is still just a block queued after E). What it does depend on is a single
    // piece of Swift runtime behavior — that `@MainActor`'s default executor queues onto the
    // main queue — which hasn't been traced down to source. Conversely, if the JS side doesn't
    // preserve the order (e.g. calling initializeAsync first), there's no guarantee — this is
    // a GMA-wide calling convention that can't be closed off from the native side.
    Function("setRequestConfiguration") { (config: [String: Any?]) in
      DispatchQueue.main.async {
        let requestConfiguration = MobileAds.shared.requestConfiguration
        if let testDeviceIds = config["testDeviceIds"] as? [String] {
          requestConfiguration.testDeviceIdentifiers = testDeviceIds
        }
        if let childDirected = config["tagForChildDirectedTreatment"] as? Bool {
          requestConfiguration.tagForChildDirectedTreatment = NSNumber(value: childDirected)
        }
        if let underAge = config["tagForUnderAgeOfConsent"] as? Bool {
          requestConfiguration.tagForUnderAgeOfConsent = NSNumber(value: underAge)
        }
        if let rating = config["maxAdContentRating"] as? String {
          // The Swift-side type name is `GADMaxAdContentRating` (the GAD prefix isn't dropped
          // because the NS_TYPED_ENUM typedef itself has no NS_SWIFT_NAME).
          requestConfiguration.maxAdContentRating = GADMaxAdContentRating(rawValue: rating)
        }
      }
    }

    // These 3 size-calculation functions are deliberately synchronous in the JS API (by
    // design, so the caller can finalize layout inline before the ad loads, avoiding a later
    // layout shift). Meanwhile `GADAdSize.h` explicitly documents most of these as
    // "must be called on the main queue", so hopping to main via `runOnMain` while staying
    // synchronous is the only option. These 3 are the only places in this module that can
    // deliberately reach `main.sync`. The residual risk (a deadlock if main happens to be
    // synchronously waiting on the JS runtime at that instant) is the same as documented in
    // the `runOnMain` comment in BannerAd.swift, and is accepted for the same reasons: the
    // call is short, purely numeric, and never re-enters JS.
    Function("getAnchoredAdaptiveSize") { (width: Double, orientation: String) -> [String: Any] in
      runOnMain {
        let adSize: AdSize
        switch orientation {
        case "portrait": adSize = portraitAnchoredAdaptiveBanner(width: width)
        case "landscape": adSize = landscapeAnchoredAdaptiveBanner(width: width)
        default: adSize = currentOrientationAnchoredAdaptiveBanner(width: width)
        }
        return ["width": adSize.size.width, "height": adSize.size.height]
      }
    }

    Function("getLargeAnchoredAdaptiveSize") { (width: Double, orientation: String) -> [String: Any] in
      runOnMain {
        let adSize: AdSize
        switch orientation {
        case "portrait": adSize = largePortraitAnchoredAdaptiveBanner(width: width)
        case "landscape": adSize = largeLandscapeAnchoredAdaptiveBanner(width: width)
        default: adSize = largeAnchoredAdaptiveBanner(width: width)
        }
        return ["width": adSize.size.width, "height": adSize.size.height]
      }
    }

    Function("getInlineAdaptiveSize") { (width: Double, maxHeight: Double?, orientation: String) -> [String: Any] in
      runOnMain {
        let adSize: AdSize
        if let maxHeight {
          adSize = inlineAdaptiveBanner(width: width, maxHeight: maxHeight)
        } else {
          switch orientation {
          case "portrait": adSize = portraitInlineAdaptiveBanner(width: width)
          case "landscape": adSize = landscapeInlineAdaptiveBanner(width: width)
          default: adSize = currentOrientationInlineAdaptiveBanner(width: width)
          }
        }
        return ["width": adSize.size.width, "height": adSize.size.height]
      }
    }

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

    View(BannerAdView.self) {
      Prop("ad") { (view: BannerAdView, ad: BannerAd?) in
        view.setAd(ad)
      }
    }
  }
}
