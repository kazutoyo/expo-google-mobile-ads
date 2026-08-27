import ExpoModulesCore
import GoogleMobileAds
import UIKit

/// Shared base for the two full-screen formats (interstitial and rewarded).
///
/// A full-screen ad has no view: it is constructed, starts loading immediately, and is presented
/// later through `showAsync()`. Both SDKs treat these objects as **single-use** — GMA answers a
/// second `present(from:)` with `GADPresentationErrorCodeAdAlreadyUsed` (18) — so `"shown"` is a
/// terminal status and the caller is expected to build a new ad for the next impression. The JS
/// side already refuses to call `showAsync()` unless `status == "loaded"` (`assertShowable` in
/// `src/FullScreenAd.ts`), so the guards below are only a native-side backstop, not a repeat of
/// that check.
///
/// Like `BannerAd`, this is a `SharedObject`, which is not an `NSObject` subclass and therefore
/// cannot conform to `FullScreenContentDelegate` (an ObjC protocol requiring `NSObjectProtocol`)
/// directly. Delegate callbacks arrive through `FullScreenAdDelegateProxy`, exactly as the banner
/// receives them through `BannerAdDelegateProxy`.
class FullScreenAd: SharedObject {
  let adUnitId: String
  private let requestOptions: [String: Any?]?

  /// Retained by this object because `fullScreenContentDelegate` on the GMA ad is a `weak`
  /// property — nothing else would keep the proxy alive.
  let delegateProxy = FullScreenAdDelegateProxy()

  // status/error/responseInfo are written from GMA callbacks (main thread) and read from the JS
  // side through `Property` getters, which run on the JS thread. Guarded by an `NSLock` rather
  // than a main-thread hop, for the reasons spelled out at length on `runOnMain` and on
  // `BannerAd`'s own state fields: a synchronous `main.sync` from a `Property` body runs while
  // the JS runtime is held, and can collide with the path where main synchronously interrupts
  // that same runtime.
  private let stateLock = NSLock()
  private var _status: String = "loading"
  private var _error: [String: Any?]?
  private var _responseInfo: [String: Any?]?

  var status: String {
    stateLock.lock()
    defer { stateLock.unlock() }
    return _status
  }

  var error: [String: Any?]? {
    stateLock.lock()
    defer { stateLock.unlock() }
    return _error
  }

  var responseInfo: [String: Any?]? {
    stateLock.lock()
    defer { stateLock.unlock() }
    return _responseInfo
  }

  /// The promise handed over by `showAsync()`, held only for as long as it is unsettled.
  ///
  /// Written and read exclusively on the main thread: `showAsync()` dispatches there before
  /// touching it, and every beat that settles it (`FullScreenContentDelegate` callbacks, which
  /// GMA declares `NS_SWIFT_UI_ACTOR`, and the teardown block) is already on main.
  private var showPromise: Promise?

  /// Whether teardown by `sharedObjectWillRelease()` has run. Main thread only, same as
  /// `BannerAd.isReleased`.
  private(set) var isReleased = false

  init(adUnitId: String, requestOptions: [String: Any?]?) {
    self.adUnitId = adUnitId
    self.requestOptions = requestOptions
    super.init()
    delegateProxy.owner = self
  }

  // MARK: - Loading

  /// Called from JS as a synchronous `Function` with no return value, so — like `BannerAd.load()`
  /// — the body only dispatches onto main and returns immediately rather than blocking the JS
  /// thread with `main.sync`.
  func load() {
    DispatchQueue.main.async { [self] in
      if isReleased {
        // Already released; there is nothing left to present, so loading would only burn a
        // request and leak an ad object.
        return
      }
      // **`"shown"` is terminal.** Both SDKs treat these ads as single-use (iOS answers a second
      // `present(from:)` with `AdAlreadyUsed`, Android with `AD_REUSED`) and `FullScreenAdStatus`
      // in src/types.ts documents it that way, so reloading a shown ad would revive a spent
      // object. On rewarded that is a real-money bug: the earned-reward latch belongs to the
      // presentation that set it, and carrying it into a second one would resolve `show()` with a
      // reward nobody earned. Refuse, leaving the status at `"shown"`.
      if status == "shown" {
        return
      }
      // A reload while a presentation is in flight would tear the ad out from under it and orphan
      // the show promise.
      if showPromise != nil {
        return
      }
      // Drop anything left from a previous load — the old ad's delegate and paid closure, and (on
      // rewarded) the earned-reward latch and reward snapshot. Nothing from a previous load may
      // survive into this one.
      tearDownAd()
      setStatus("loading", error: nil)
      loadAd(request: makeRequest())
    }
  }

  /// Reports a failure that happened before `load()` could run — currently only "the SDK failed to
  /// initialize", which the JS side detects. Without it the ad would sit on `loading` forever,
  /// because no GMA callback is ever going to fire.
  func markLoadFailed(_ message: String) {
    DispatchQueue.main.async { [self] in
      // Same check the load-success path makes: a released ad reports nothing.
      if isReleased {
        return
      }
      setStatus("error", error: [
        "code": -1,
        "message": message,
        "domain": "ExpoGoogleMobileAds",
      ])
    }
  }

  /// Builds the ad request from the JS-side `RequestOptions`.
  ///
  /// This repeats the four lines `BannerAd.load()` has inline. Extracting a shared helper would
  /// mean editing `BannerAd.swift`, which is outside this change; the duplication is small and
  /// both copies read the same two keys of the same JS type.
  private func makeRequest() -> Request {
    let request = Request()
    if let keywords = requestOptions?["keywords"] as? [String] {
      request.keywords = keywords
    }
    if let contentUrl = requestOptions?["contentUrl"] as? String {
      request.contentURL = contentUrl
    }
    // networkExtras is not supported yet, for the same reason as on the banner: it needs a
    // concrete mediation adapter. See `RequestOptions` in src/types.ts.
    return request
  }

  /// Subclass hook. Starts the SDK-side load; called on the main thread.
  func loadAd(request: Request) {}

  /// Subclass hook. Presents the loaded ad, returning `false` if there is no ad object to present
  /// — in which case `showAsync()` rejects rather than leaving its promise pending forever.
  ///
  /// `@MainActor` because GMA declares `present(from:)` (and `present(from:userDidEarnRewardHandler:)`)
  /// `NS_SWIFT_UI_ACTOR`, which Swift imports as main-actor isolation.
  @MainActor
  func presentAd(from viewController: UIViewController) -> Bool { false }

  /// Subclass hook. Clears the ad's delegate and closure properties, drops it, and resets any
  /// per-ad state (the rewarded latch). Called on the main thread from four sites: release
  /// teardown, the start of `load()`, and each subclass's `handleLoadCompletion` before it
  /// replaces an existing ad. It must therefore be idempotent and safe with no ad present.
  ///
  /// **It must never run against an ad that is currently presenting** — that clears the delegate
  /// the show promise is waiting on. `shouldDiscardLoadResult` is what keeps the completion-handler
  /// call sites off that path.
  func tearDownAd() {}

  /// Whether a load result that has just arrived must be **discarded** rather than installed.
  ///
  /// Installing an ad means calling `tearDownAd()` on whatever is already here, and that is
  /// destructive: it nils `fullScreenContentDelegate` and `paidEventHandler` on the existing ad.
  /// Doing so to an ad that is mid-presentation would drop the very delegate that
  /// `adDidDismissFullScreenContent` arrives on, leaving `showAsync()`'s promise pending forever,
  /// and would silently lose that ad's remaining `impression`/`clicked`/`paid` events. It would
  /// also let `handleLoaded` resurrect the terminal `"shown"` status back to `"loaded"`, sneaking
  /// past the guard in `load()`.
  ///
  /// Reachable because two loads can overlap: `load()` refuses to start a second request while a
  /// show is in flight, but a request issued *before* the show can still land during it.
  ///
  /// Read on the main thread from both subclasses' `handleLoadCompletion`.
  var shouldDiscardLoadResult: Bool {
    isReleased || showPromise != nil || status == "shown"
  }

  /// Subclass hook. What `showAsync()` resolves with on dismissal. Interstitial resolves with
  /// nothing; `FullScreenRewardedAd` overrides this to return the latched reward, or nil.
  func showResult() -> [String: Any]? { nil }

  /// Called by a subclass from its load completion handler, on the main thread.
  func handleLoaded(responseInfo info: ResponseInfo?) {
    // Walk the GMA response info outside the lock: `stateLock` is taken by the JS-side Property
    // getters, and there is no reason to hold it across arbitrary SDK work and allocation.
    let responseInfo = responseInfoToDictionary(info)
    stateLock.lock()
    _status = "loaded"
    _error = nil
    _responseInfo = responseInfo
    stateLock.unlock()
    emitStatusChange()
  }

  /// Called by a subclass from its load completion handler, on the main thread.
  func handleLoadFailed(_ error: Error) {
    // The same guard the success path uses, and it subsumes the `isReleased` check that used to be
    // here. A load failure must never be recorded while an ad is presenting or after it has shown:
    // with two loads outstanding, a late failure from request #1 would overwrite `"shown"` with
    // `"error"` and emit a `statusChange` reporting a successful impression as a failure. Worse,
    // `load()`'s terminal guard tests only `status == "shown"`, so an ad parked on `"error"` can be
    // loaded and shown a second time — this is the last path that could reopen the terminal-status
    // invariant that rounds 1 and 2 exist to protect. There is no legitimate case where a failure
    // should land in either state, so discarding it is strictly correct.
    if shouldDiscardLoadResult {
      return
    }
    setStatus("error", error: errorToDictionary(error))
  }

  // MARK: - Showing

  /// Presents the ad and hands the promise over to whichever beat settles it.
  ///
  /// **The promise is settled from four places, and every one of them matters.** A failed
  /// presentation never dismisses, so settling only on dismissal leaves it pending forever:
  ///
  /// 1. `adDidDismissFullScreenContent` — resolves (with the reward, on rewarded).
  /// 2. `ad(_:didFailToPresentFullScreenContentWithError:)` — rejects.
  /// 3. Here, synchronously, when there is nothing to present: no view controller, no ad object,
  ///    the ad was already released, or a presentation is already in flight.
  /// 4. `sharedObjectWillRelease()`'s teardown — the delegate is about to be cleared, so no
  ///    further callback is coming.
  func showAsync(_ promise: Promise) {
    DispatchQueue.main.async { [self] in
      if isReleased {
        promise.reject(
          "ERR_AD_RELEASED",
          "The ad was released before it could be shown.")
        return
      }
      if showPromise != nil {
        // Two overlapping show() calls. JS gates on `status`, but both calls can pass that gate
        // before either reaches native, so reject the second rather than orphaning the first
        // promise (the SDK would also fail this with AdAlreadyUsed, but only asynchronously).
        promise.reject(
          "ERR_AD_ALREADY_PRESENTING",
          "This ad is already being presented.")
        return
      }
      // `currentViewController()` means "the frontmost view controller right now", so resolving it
      // at construction time would leave it nil for an ad preloaded before any view controller
      // exists, or stale after a modal closed. Resolved fresh at show time, every time.
      guard let viewController = resolveRootViewController() else {
        promise.reject(
          "ERR_NO_VIEW_CONTROLLER",
          "Could not show the ad because no visible view controller was found. "
            + "Try again after the app has finished launching.")
        return
      }

      showPromise = promise
      // Safe: this closure runs on the main queue, which is the main actor's executor. The hop is
      // needed because `present(from:)` is main-actor-isolated in Swift (NS_SWIFT_UI_ACTOR) while
      // this closure is not.
      let presented = MainActor.assumeIsolated { presentAd(from: viewController) }
      if !presented {
        showPromise = nil
        promise.reject(
          "ERR_AD_NOT_AVAILABLE",
          "Could not show the ad because it is no longer available.")
      }
    }
  }

  /// Settles the pending show promise, if there is one, and clears it. Main thread only.
  private func settleShowPromise(_ settle: (Promise) -> Void) {
    guard let promise = showPromise else { return }
    showPromise = nil
    settle(promise)
  }

  private func resolveRootViewController() -> UIViewController? {
    if let viewController = appContext?.utilities?.currentViewController() {
      return viewController
    }
    return UIApplication.shared.connectedScenes
      .compactMap { ($0 as? UIWindowScene)?.keyWindow?.rootViewController }
      .first
  }

  // MARK: - State

  private func setStatus(_ status: String, error: [String: Any?]?) {
    stateLock.lock()
    _status = status
    _error = error
    stateLock.unlock()
    emitStatusChange()
  }

  private func emitStatusChange() {
    emit(event: "statusChange", payload: ["status": status, "error": error as Any])
  }

  /// GMA reports paid events through the `paidEventHandler` closure property, not through
  /// `FullScreenContentDelegate` — the same asymmetry phase 1 hit on banners. Subclasses install
  /// the closure when the ad loads and forward it here.
  func emitPaid(_ value: AdValue) {
    emit(event: "paid", payload: [
      "value": value.value.doubleValue,
      "currencyCode": value.currencyCode,
      "precision": adValuePrecisionToString(value.precision),
    ])
  }

  // MARK: - Release

  /// **Must not use `runOnMain` / `DispatchQueue.main.sync` here.** Expo calls this from
  /// `SharedObjectRegistry.delete(_:)` while holding the registry's mutex, and the main thread
  /// takes that same mutex when it resolves a shared object for a prop. Blocking on main from
  /// here reverses the lock order into a deadlock. See the long comment on
  /// `BannerAd.sharedObjectWillRelease()` for the full argument — it applies unchanged.
  ///
  /// So this hands the cleanup to main "fire and forget"; the closure's strong `self` keeps the
  /// ad alive until it runs.
  override func sharedObjectWillRelease() {
    DispatchQueue.main.async { [self] in
      isReleased = true
      // The delegate is about to be cleared, so neither a dismissal nor a presentation failure is
      // going to arrive for an in-flight show(). Settle it here or it never settles.
      settleShowPromise {
        $0.reject("ERR_AD_RELEASED", "The ad was released while it was being shown.")
      }
      tearDownAd()
    }
  }

  // MARK: - FullScreenContentDelegate callbacks (forwarded from FullScreenAdDelegateProxy)
  // GMA declares every one of these NS_SWIFT_UI_ACTOR, so they arrive on the main thread and no
  // further hop is needed.

  /// Note this is `adWillPresentFullScreenContent`, not `adDidPresentFullScreenContent`: the
  /// latter is `NS_UNAVAILABLE` in 13.7.0 and does not compile, despite still appearing in
  /// Google's own docs and samples. There is no "did present" beat at all.
  fileprivate func handleWillPresent() {
    setStatus("shown", error: nil)
    emit(event: "showed")
  }

  fileprivate func handleDidDismiss() {
    emit(event: "dismissed")
    settleShowPromise { promise in
      if let result = showResult() {
        promise.resolve(result)
      } else {
        promise.resolve()
      }
    }
  }

  fileprivate func handleFailToPresent(_ error: Error) {
    setStatus("error", error: errorToDictionary(error))
    settleShowPromise {
      $0.reject("ERR_AD_SHOW_FAILED", (error as NSError).localizedDescription)
    }
  }

  fileprivate func handleImpression() {
    emit(event: "impression")
  }

  fileprivate func handleClick() {
    emit(event: "clicked")
  }
}

/// The error reported when a load completion handler hands back neither an ad nor an error. The
/// headers say exactly one of the two is non-nil, so this should be unreachable — but reporting
/// nothing would leave the ad on `"loading"` forever with no error anywhere.
func missingAdError() -> NSError {
  NSError(
    domain: "ExpoGoogleMobileAds",
    code: -1,
    userInfo: [
      NSLocalizedDescriptionKey: "The Google Mobile Ads SDK reported neither an ad nor an error.",
    ])
}

/// `FullScreenContentDelegate` (an ObjC protocol) requires `NSObjectProtocol`, which a
/// `SharedObject` cannot declare conformance to. Same constraint, and same solution, as
/// `BannerAdDelegateProxy`.
final class FullScreenAdDelegateProxy: NSObject, FullScreenContentDelegate {
  weak var owner: FullScreenAd?

  func adWillPresentFullScreenContent(_ ad: any FullScreenPresentingAd) {
    owner?.handleWillPresent()
  }

  func adDidDismissFullScreenContent(_ ad: any FullScreenPresentingAd) {
    owner?.handleDidDismiss()
  }

  func ad(
    _ ad: any FullScreenPresentingAd,
    didFailToPresentFullScreenContentWithError error: any Error
  ) {
    owner?.handleFailToPresent(error)
  }

  func adDidRecordImpression(_ ad: any FullScreenPresentingAd) {
    owner?.handleImpression()
  }

  func adDidRecordClick(_ ad: any FullScreenPresentingAd) {
    owner?.handleClick()
  }
}
