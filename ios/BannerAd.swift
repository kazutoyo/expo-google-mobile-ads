import ExpoModulesCore
import GoogleMobileAds
import UIKit

/// Runs synchronously on the main thread if already there; otherwise hops to the main
/// thread synchronously via `DispatchQueue.main.sync` before running.
///
/// Most UIKit and GoogleMobileAds APIs are main-thread-only (`GADAdSize.h`'s adaptive size
/// functions explicitly say "This function must be called on the main queue."). Meanwhile,
/// Expo Modules' `Constructor` / `Function` / `Property` bodies can run on any thread (even
/// `AsyncFunction`'s default queue isn't main), so any code touching UIKit/GMA is synced to
/// the main thread through this function.
///
/// **The remaining risk (stated plainly)**: React Native's New Architecture has a real path
/// where the main thread synchronously interrupts the JS runtime
/// (`AppleEventBeat::activityDidChange` → `EventBeat::induce()` →
/// `RuntimeScheduler::executeNowOnTheSameThread` — `EventBeat.cpp` itself comments
/// "Both JS and UI thread are blocked". This can also be reached via `experimental_flushSync`
/// or third-party libraries). A synchronous `Function`/`Property` body runs on the JS thread
/// **while holding the JS runtime**, so if main tries to synchronously interrupt that same
/// runtime through this path while we're in the middle of calling `main.sync` there, both
/// sides end up waiting on each other. In other words, you cannot claim "call sites using
/// `main.sync` are safe because no lock is held" — this is an inherent risk of any API that
/// offers a synchronous main-thread hop, not a defect specific to `runOnMain`.
///
/// For that reason, call sites for this `runOnMain` (i.e. the blocking `main.sync`) are kept
/// to a minimum. Grepping all of `ios/`, there are exactly 4 call sites (excluding this
/// function's own definition). For each, here's why it can't be made asynchronous, stated
/// only to the extent it can be backed up:
///
/// 1. `getAnchoredAdaptiveSize` / `getLargeAnchoredAdaptiveSize` / `getInlineAdaptiveSize` in
///    `ExpoGoogleMobileAdsModule.swift` (3 call sites). These are deliberately synchronous in
///    the JS API (by design, so the caller can finalize layout before the ad loads), so they
///    can't be made async, and `GADAdSize.h` explicitly documents them as main-thread-only,
///    so hopping to main while staying synchronous is the only option. **These 3 are the only
///    places where the JS thread can reach `main.sync` while still holding the JS runtime**
///    (the remaining call site below never takes the sync branch, because its callers are
///    already all on the main thread). So this is the only place actually carrying the
///    residual risk described above, and it's kept deliberately, with full awareness. The
///    reason it's acceptable: this call is short, pure numeric computation, and never
///    re-enters JS.
/// 2. `bannerView` (the lazy property below). It has to return a `BannerView?`, so it can't
///    be `DispatchQueue.main.async`. Grep confirms its only callers are the
///    `DispatchQueue.main.async` block inside `load()` (1 site) and `BannerAdView`'s `setAd` /
///    `detachCurrentAdIfOwned` / `layoutSubviews` — all of which are already on the main
///    thread (`ExpoView = ExpoFabricView` being `@MainActor` was confirmed against
///    `ExpoModulesCore.swiftinterface`). So in practice only the `Thread.isMainThread`
///    early-return branch ever executes.
///    (`sharedObjectWillRelease` reads `_bannerView` directly rather than through this
///    property.)
///
/// Note that the line between where `main.sync` is fine and where it isn't is **not** "does
/// the caller hold a lock" (the JS runtime itself is the contended resource, so that kind of
/// safety claim can't be made here). A path known to be called while holding a lock, like
/// `sharedObjectWillRelease()`, is simply out of the question because it multiplies the odds
/// of a deadlock — that one uses `DispatchQueue.main.async` instead. See that method's own
/// comment for details.
///
/// Places where `main.sync` was deliberately removed under this policy:
/// - Reads of `status`/`error`/`loadedSize`/`responseInfo` (a hot path that runs on every JS
///   render) → replaced with an `NSLock` that doesn't contend for main, closing only the data
///   race.
/// - `load()` and `setRequestConfiguration` (`ExpoGoogleMobileAdsModule.swift`) → both are
///   synchronous `Function`s with no return value, so `DispatchQueue.main.async` is enough.
func runOnMain<T>(_ block: () -> T) -> T {
  if Thread.isMainThread {
    return block()
  }
  return DispatchQueue.main.sync(execute: block)
}

/// Thrown when `size` doesn't contain numeric `width`/`height`.
/// This used to silently degrade to a 0×0 banner via `?? 0`, but a configuration mistake
/// should be surfaced to the caller as an exception (a 0×0 banner is just an unexplainable
/// "the ad doesn't show up" bug).
final class InvalidBannerSizeException: Exception, @unchecked Sendable {
  override var reason: String {
    "BannerAd's size requires numeric width and height"
  }
}

/// An ad instance that can be held and loaded without being placed in the view hierarchy.
/// `BannerAdView` addSubviews `bannerView` on mount and only removeFromSuperview on unmount —
/// it never destroys it, which is what lets it survive across screen transitions.
///
/// `SharedObject` (expo-modules-core) is a Swift class that doesn't inherit from `NSObject`,
/// so it cannot directly conform to `BannerViewDelegate`, an ObjC protocol that requires
/// `NSObjectProtocol` (`cannot declare conformance to 'NSObjectProtocol' in Swift` is a build
/// error). So events are received through a small NSObject-based proxy, `BannerAdDelegateProxy`,
/// instead.
final class BannerAd: SharedObject {
  private var _bannerView: BannerView?

  /// Whether teardown by `sharedObjectWillRelease()` has completed. Once true, a new
  /// `GADBannerView` is never created again. Only read/written from code on the main thread
  /// (either via `runOnMain`'s early-return path, or inside `sharedObjectWillRelease`'s
  /// `DispatchQueue.main.async` block), so like `_bannerView` it's serialized on main.
  private var isReleased = false

  /// Held without being placed in the view hierarchy. `BannerAdView` addSubviews it when
  /// displaying. After teardown (post-`release()`), returns `nil` and never creates a new
  /// `GADBannerView` again — otherwise a View that still holds a released ad, upon receiving
  /// props again, would end up creating and mounting a fresh, empty (nothing-loaded) banner
  /// on its own.
  ///
  /// Lazily created because creating/configuring a `GADBannerView` is a main-thread-only
  /// UIKit/GMA operation, while `Constructor` must return an object to JS synchronously —
  /// synchronously hopping to main inside init is something we'd rather avoid (including in
  /// environments where the JS thread is the main thread, and in test environments). Creation
  /// is deferred until it's actually needed, at `load()` or `BannerAdView` attachment time.
  var bannerView: BannerView? {
    runOnMain {
      if isReleased {
        return nil
      }
      if let existing = _bannerView {
        return existing
      }
      // `adSizeFor(cgSize:)` builds a *fixed* custom ad size (flags = 1). Feeding it an inline
      // adaptive size's numbers would silently turn "up to this height" into "exactly this
      // height", so an inline adaptive request is rebuilt through the SDK function that sets
      // the inline flag (flags = 128) instead. See `inlineAdaptive()` in BannerAdSize.ts.
      let adSize = isInlineAdaptive
        ? inlineAdaptiveBanner(width: adWidth, maxHeight: adHeight)
        : adSizeFor(cgSize: CGSize(width: adWidth, height: adHeight))
      let view = BannerView(adSize: adSize)
      view.adUnitID = adUnitId
      view.delegate = delegateProxy
      // GMA reports paid events via a closure, not the delegate.
      view.paidEventHandler = { [weak self] value in
        self?.emit(event: "paid", payload: [
          "value": value.value.doubleValue,
          "currencyCode": value.currencyCode,
          "precision": adValuePrecisionToString(value.precision),
        ])
      }
      _bannerView = view
      return view
    }
  }

  /// The BannerAdView currently displaying this ad. Used to decide ownership (`weak`, so it
  /// automatically becomes nil once the view is deallocated).
  weak var currentAttachment: BannerAdView?

  /// The view `currentAttachment` took this ad from. When the current owner gives the ad up,
  /// it is handed back to this view if that view is still alive and still wants the ad —
  /// otherwise a view that lost the ad to a second view would stay blank forever, because its
  /// `ad` prop never changes and Fabric therefore never calls `setAd` on it again.
  /// `weak` for the same reason as `currentAttachment`.
  weak var previousAttachment: BannerAdView?

  /// The requested size. Becomes `ad.size` on the JS side.
  let requestedSize: [String: Any?]

  private let adUnitId: String
  private let adWidth: Double
  private let adHeight: Double
  /// When true, `adHeight` is a maximum rather than a fixed height.
  private let isInlineAdaptive: Bool
  private let requestOptions: [String: Any?]?
  private let delegateProxy = BannerAdDelegateProxy()

  // status/error/loadedSize/responseInfo are written from BannerViewDelegate callbacks (main
  // thread) and read from JS-side Property getters (a hot path that runs on every React
  // render). Reads used to be synced to the main thread via `runOnMain` (i.e. `main.sync`),
  // but that takes the form of "the JS thread holds the JS runtime while waiting for main to
  // finish", which can collide in lock ordering with the path where main synchronously
  // interrupts that same runtime (see `runOnMain`'s comment) — and it needlessly exposes a
  // frequently-called path to however backed-up main happens to be. Replaced with an `NSLock`
  // that doesn't contend for main, closing only the data race.
  private let stateLock = NSLock()
  private var _status: String = "loading"
  private var _error: [String: Any?]?
  private var _loadedSize: [String: Any?]?
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

  var loadedSize: [String: Any?]? {
    stateLock.lock()
    defer { stateLock.unlock() }
    return _loadedSize
  }

  var responseInfo: [String: Any?]? {
    stateLock.lock()
    defer { stateLock.unlock() }
    return _responseInfo
  }

  init(adUnitId: String, size: [String: Any?], requestOptions: [String: Any?]?) throws {
    guard let width = size["width"] as? Double, let height = size["height"] as? Double else {
      throw InvalidBannerSizeException()
    }
    self.adWidth = width
    self.adHeight = height
    self.isInlineAdaptive = size["inlineAdaptive"] as? Bool ?? false
    // Rebuilt rather than echoed back, so `ad.size` reports the same three keys on both
    // platforms (Android composes this map from its `AdSize`, which cannot carry extra keys).
    self.requestedSize = [
      "width": width,
      "height": height,
      "inlineAdaptive": self.isInlineAdaptive,
    ]
    self.adUnitId = adUnitId
    self.requestOptions = requestOptions
    super.init()
    delegateProxy.owner = self
  }

  /// Called from JS as a synchronous function (`Function("load")`, no return value), but the
  /// body just dispatches to `DispatchQueue.main.async`. This used to block the calling thread
  /// with `runOnMain` (i.e. `main.sync`), but since `load()` has no return value, there's no
  /// reason to hold up the JS-side thread waiting for main to finish.
  func load() {
    DispatchQueue.main.async { [self] in
      guard let view = bannerView else {
        // Already release()d. Nothing left to show, so do nothing.
        return
      }

      setStatus("loading", error: nil)

      // rootViewController is weak and means "the currently-frontmost view controller", so
      // resolving it once at init time and caching it would leave it nil during preload
      // (before any view controller exists), or stale after a modal closes later. Resolve it
      // fresh on every load() call.
      guard let rootViewController = resolveRootViewController() else {
        setStatus("error", error: [
          "code": -1,
          "message":
            "Could not load the ad because no visible view controller was found. "
            + "Try again after the app finishes launching, or after BannerAdView has mounted, and call load() again.",
          "domain": "ExpoGoogleMobileAds",
        ])
        return
      }
      view.rootViewController = rootViewController

      let request = Request()
      if let keywords = requestOptions?["keywords"] as? [String] {
        request.keywords = keywords
      }
      if let contentUrl = requestOptions?["contentUrl"] as? String {
        request.contentURL = contentUrl
      }
      // networkExtras (adapter-specific GADAdNetworkExtras) isn't supported yet, since it
      // depends on a concrete mediation adapter implementation. Implement it alongside a
      // task that adds a specific mediation network.
      view.load(request)
    }
  }

  /// Reports a failure that happened before `load()` could even run — currently only "the SDK
  /// failed to initialize", which the JS side detects. Without this the ad would sit on
  /// `loading` forever with no error anywhere, since no GMA callback is ever going to fire.
  ///
  /// Dispatched to main for the same reason as `load()`: this is called synchronously from the
  /// JS thread, and every other write to the state/`statusChange` pair happens on main.
  func markLoadFailed(_ message: String) {
    DispatchQueue.main.async { [self] in
      setStatus("error", error: [
        "code": -1,
        "message": message,
        "domain": "ExpoGoogleMobileAds",
      ])
    }
  }

  /// Resolves the currently-visible view controller fresh every time. If not yet mounted in a
  /// `BannerAdView` (i.e. still preloading), `Utilities.currentViewController()` may not yet
  /// have anything to return, so this falls back to the app's key window's rootViewController.
  private func resolveRootViewController() -> UIViewController? {
    if let vc = appContext?.utilities?.currentViewController() {
      return vc
    }
    return UIApplication.shared.connectedScenes
      .compactMap { ($0 as? UIWindowScene)?.keyWindow?.rootViewController }
      .first
  }

  /// Updates status/error together under the lock, then fires `statusChange` with the updated
  /// values.
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

  /// Called just before the JS side calls `release()` and the SharedObject's registry entry
  /// is torn down. `release()` only severs the link to JS and does no native-side cleanup on
  /// its own, so here we detach the delegate, clear the paid-event closure, and remove the ad
  /// from its view. The view's own `currentAd` property can end up never explicitly cleared by
  /// anyone (even if Fabric's recycling calls prepareForRecycle), but since `bannerView` checks
  /// `isReleased` and refuses to create a new one, at minimum native ad display, impression
  /// tracking, event firing, and creating a new `GADBannerView` are all guaranteed to stop.
  ///
  /// **Must not use `runOnMain` (i.e. `DispatchQueue.main.sync`) here**: `SharedObjectRegistry.delete`
  /// calls this method while holding the registry's `Mutex` (`state.withLock`) (see
  /// `SharedObjectRegistry.swift`'s `delete(_:)`). Meanwhile, when the main thread sets the `ad`
  /// prop on a `BannerAdView`, it goes through `ExpoFabricViewObjC`'s `updateProps` →
  /// `DynamicSharedObjectType.cast` → `registry.get`, which takes the same `state.withLock`.
  /// Using `main.sync` here would let "JS thread: holds the registry lock → waits for main to
  /// finish" and "main thread: waits for the registry lock while mounting some other ad" hold
  /// simultaneously in opposite directions, reversing lock order into a deadlock (one that's
  /// hard to reproduce even in ordinary manual testing, let alone in a build — the app just
  /// silently freezes).
  ///
  /// So this closure only holds a strong reference to `self` for what teardown needs, and
  /// hands the cleanup off to the main thread "fire and forget" via `DispatchQueue.main.async`.
  /// That way this method itself never blocks and returns immediately, and `state.withLock` is
  /// released right away (i.e. the registry side waits on nobody). Reading `_bannerView` was
  /// also moved into this async block (fixed in review round 2, where it used to be read on
  /// the caller's thread) — reading `_bannerView` unsynchronized from the caller's thread
  /// (often the JS thread) would race with writes from the main thread (lazy creation inside
  /// `bannerView`).
  ///
  /// As long as the closure keeps holding `self` after this method returns, `BannerAd` (and the
  /// `GADBannerView` it owns) stays alive until the async block runs. During that window, the
  /// only code that can touch `_bannerView`/`currentAttachment`/`isReleased` is code on the
  /// main thread, which is serialized with this async block on GCD's main queue, so no
  /// inconsistent state can be observed in between.
  ///
  /// Note that `sharedObjectDidRelease()` (not currently overridden) is also called while
  /// holding that same `state.withLock` (see `delete(_:)` in `SharedObjectRegistry.swift`). If
  /// it's ever overridden in the future, the same reasoning applies: don't use
  /// `runOnMain`/`main.sync` there either.
  override func sharedObjectWillRelease() {
    DispatchQueue.main.async { [self] in
      isReleased = true
      guard let view = _bannerView else { return }
      view.delegate = nil
      view.paidEventHandler = nil
      view.removeFromSuperview()
      currentAttachment = nil
      previousAttachment = nil
      // Drop the last strong reference to the GADBannerView (a UIView) here, so that the
      // UIView's deallocation happens on the main thread.
      _bannerView = nil
    }
  }

  // MARK: - BannerViewDelegate callbacks (forwarded from BannerAdDelegateProxy)
  // GMA always calls these callbacks on the main thread, so no extra main hop is needed.

  fileprivate func handleDidReceiveAd(_ bannerView: BannerView) {
    // Do the GMA-touching work (reading `adSize`/`responseInfo`, and walking
    // `adNetworkInfoArray` to build a dictionary in `responseInfoToDictionary`) outside the
    // lock, up front. `stateLock` is taken from the Property getter on every JS render, so we
    // don't want to interleave arbitrary GMA work and allocation with that. The lock is only
    // taken for the assignment itself.
    let size: [String: Any?] = [
      "width": bannerView.adSize.size.width,
      "height": bannerView.adSize.size.height,
    ]
    let info = responseInfoToDictionary(bannerView.responseInfo)

    stateLock.lock()
    _status = "loaded"
    // GMA auto-refreshes banners, so a failure-then-success transition is a normal occurrence.
    // If `_error` isn't cleared here, `status === "loaded"` would coexist with a stale error,
    // which also rides along in the `statusChange` payload — leading a consumer to keep
    // showing an error next to an ad that's actually displaying fine. Always clear it on
    // success.
    _error = nil
    _loadedSize = size
    _responseInfo = info
    stateLock.unlock()
    emitStatusChange()
  }

  fileprivate func handleDidFailToReceiveAd(withError err: Error) {
    setStatus("error", error: errorToDictionary(err))
  }

  fileprivate func handleDidRecordImpression() {
    emit(event: "impression")
  }

  fileprivate func handleDidRecordClick() {
    emit(event: "clicked")
  }
}

/// `BannerViewDelegate` (an ObjC protocol) requires `NSObjectProtocol`, so `BannerAd`
/// (a `SharedObject`, which doesn't inherit from `NSObject`) can't conform to it directly.
/// This NSObject-based proxy forwards whatever events it receives to `owner`'s `handle...`
/// methods.
private final class BannerAdDelegateProxy: NSObject, BannerViewDelegate {
  weak var owner: BannerAd?

  func bannerViewDidReceiveAd(_ bannerView: BannerView) {
    owner?.handleDidReceiveAd(bannerView)
  }

  func bannerView(_ bannerView: BannerView, didFailToReceiveAdWithError error: Error) {
    owner?.handleDidFailToReceiveAd(withError: error)
  }

  func bannerViewDidRecordImpression(_ bannerView: BannerView) {
    owner?.handleDidRecordImpression()
  }

  func bannerViewDidRecordClick(_ bannerView: BannerView) {
    owner?.handleDidRecordClick()
  }
}
