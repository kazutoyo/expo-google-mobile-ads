import ExpoModulesCore
import GoogleMobileAds

/// Explicitly calls `MobileAds.shared.start()` on the main thread (`@MainActor`). GMA's
/// headers don't explicitly document this method as main-thread-only, but GMA is
/// conventionally initialized from the main thread, and making sure of it costs only a single
/// hop inside an async function, so hop to main without hesitation.
@MainActor
private func startMobileAdsSDK() async -> InitializationStatus {
  await MobileAds.shared.start()
}

@ExpoModule("ExpoGoogleMobileAds")
public final class ExpoGoogleMobileAdsModule: Module {
  // `@MainActor` keeps the 1.0 behavior of never running on the JS thread: the body is only an
  // await on `MobileAds.shared.start()`, which wants main anyway.
  @JS
  @MainActor
  func initializeAsync() async -> [String: Any] {
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

  // A synchronous function with no return value, so there's no reason to hold up the
  // calling thread (the JS thread) waiting for main to finish. Just dispatches to
  // `DispatchQueue.main.async`, same as `load()` (a synchronous function body runs while
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
  @JS
  func setRequestConfiguration(_ config: [String: Any?]) {
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
  //
  // All three go through `makeAdaptiveAdSize`, the same function `BannerAd` rebuilds a size
  // with once it has crossed the JS boundary — the size a caller lays out against and the size
  // actually requested therefore come from the same factory call.
  @JS
  func getAnchoredAdaptiveSize(_ width: Double, _ orientation: String) -> [String: Any] {
    runOnMain {
      let kind: BannerAdSizeKind
      switch orientation {
      case "portrait": kind = .anchoredPortrait
      case "landscape": kind = .anchoredLandscape
      default: kind = .anchored
      }
      let adSize = makeAdaptiveAdSize(kind: kind, width: width, maxHeight: 0)
      return ["width": adSize.size.width, "height": adSize.size.height]
    }
  }

  @JS
  func getLargeAnchoredAdaptiveSize(_ width: Double, _ orientation: String) -> [String: Any] {
    runOnMain {
      let kind: BannerAdSizeKind
      switch orientation {
      case "portrait": kind = .largeAnchoredPortrait
      case "landscape": kind = .largeAnchoredLandscape
      default: kind = .largeAnchored
      }
      let adSize = makeAdaptiveAdSize(kind: kind, width: width, maxHeight: 0)
      return ["width": adSize.size.width, "height": adSize.size.height]
    }
  }

  // Only the max-height form is exposed. The per-orientation helpers
  // (`portraitInlineAdaptiveBanner` and friends) return `size.height == 0` — the real bound
  // lives in `GADAdSize.flags`, which cannot cross the JS boundary as a number — so the size
  // they produce is unusable both for reserving layout space and for rebuilding an ad size
  // from `{width, height}` later. See `inlineAdaptive()` in BannerAdSize.ts.
  //
  // Unlike the anchored helpers this one is not documented as main-thread-only, but it stays
  // inside `runOnMain` for consistency with the other two: it is a short numeric call.
  @JS
  func getInlineAdaptiveSize(_ width: Double, _ maxHeight: Double) -> [String: Any] {
    runOnMain {
      let adSize = makeAdaptiveAdSize(kind: .inline, width: width, maxHeight: maxHeight)
      return ["width": adSize.size.width, "height": adSize.size.height]
    }
  }

  // MARK: - UMP consent
  //
  // All six are `@MainActor` because every UMP entry point is main-thread-only. A thrown
  // `AdException` reaches JS with its normalized `code` string, so each failure is rethrown
  // through `consentError(_:)`.
  //
  // The view controller is resolved at call time, never cached: at preload there may be none.
  // Unlike Android there is no `noActivity` failure here — `loadAndPresentIfRequired(from:)`
    // accepts nil and falls back to the top view controller of the main window, and if that is
    // unusable the SDK itself reports `invalidViewController` (9).

  @JS
  @MainActor
  func gatherConsentAsync(_ options: [String: Any?]?) async throws -> [String: Any] {
    try await consentError {
      try await Consent.requestInfoUpdate(options)
      try await Consent.showFormIfRequired(from: self.appContext?.utilities?.currentViewController())
    }
  }

  @JS
  @MainActor
  func requestConsentInfoUpdateAsync(_ options: [String: Any?]?) async throws -> [String: Any] {
    try await consentError { try await Consent.requestInfoUpdate(options) }
  }

  @JS
  @MainActor
  func showConsentFormIfRequiredAsync() async throws -> [String: Any] {
    try await consentError {
      try await Consent.showFormIfRequired(from: self.appContext?.utilities?.currentViewController())
    }
  }

  @JS
  @MainActor
  func showPrivacyOptionsFormAsync() async throws -> [String: Any] {
    try await consentError {
      try await Consent.showPrivacyOptionsForm(from: self.appContext?.utilities?.currentViewController())
    }
  }

  @JS
  @MainActor
  func getConsentInfoAsync() async -> [String: Any] {
    Consent.snapshot()
  }

  @JS
  @MainActor
  func resetConsentAsync() async -> [String: Any] {
    Consent.reset()
    return Consent.snapshot()
  }

  /// Runs a UMP step and returns the consent snapshot, mapping a UMP failure onto `AdException`.
  @MainActor
  private func consentError(_ work: () async throws -> Void) async throws -> [String: Any] {
    do {
      try await work()
      return Consent.snapshot()
    } catch let error as NSError {
      throw AdException(consentErrorCode(error), consentErrorMessage(error))
    }
  }
}
