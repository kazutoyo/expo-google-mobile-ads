import ExpoModulesCore
import GoogleMobileAds
import UIKit

/// The interstitial format. Registered with JS as `InterstitialAd`.
///
/// The Swift class is deliberately *not* named `InterstitialAd`: GMA's own
/// `GADInterstitialAd` carries `NS_SWIFT_NAME(InterstitialAd)`, so a same-named type in this
/// module would shadow it inside every file here. The JS-facing name is supplied explicitly to
/// `Class("InterstitialAd", ...)` instead.
final class FullScreenInterstitialAd: FullScreenAd {
  /// The loaded ad. Main thread only (written in `handleLoadCompletion`, read from
  /// `presentAd(from:)` and `tearDownAd()`, all of which run on main).
  private var ad: InterstitialAd?

  override func loadAd(request: Request) {
    InterstitialAd.load(with: adUnitId, request: request) { [weak self] ad, error in
      // GMA does not document which thread this completion handler runs on — unlike the
      // presentation-side members, it carries no NS_SWIFT_UI_ACTOR — so the result is hopped onto
      // main rather than assuming. Everything it touches (`ad`, `isReleased`) is main-thread-only.
      DispatchQueue.main.async {
        self?.handleLoadCompletion(ad: ad, error: error)
      }
    }
  }

  private func handleLoadCompletion(ad: InterstitialAd?, error: Error?) {
    if let error {
      handleLoadFailed(error)
      return
    }
    guard let ad else {
      // Not reachable per the header contract (exactly one of ad/error is non-nil), but a silent
      // no-op here would leave the ad stuck on "loading" with no error anywhere.
      handleLoadFailed(missingAdError())
      return
    }
    if shouldDiscardLoadResult {
      // Released, a show is in flight, or this ad has already been shown. Installing would mean
      // tearing down whatever is here — including, in the in-flight case, the delegate the show
      // promise is waiting on. Drop this ad instead.
      //
      // Dropping it is complete cleanup and leaks nothing: nothing below has run yet, so its
      // `fullScreenContentDelegate` and `paidEventHandler` are both still nil and it holds no
      // reference to this object. Returning releases the last reference and ARC frees it. (iOS
      // ads have no `destroy()`; that is an Android-only member.)
      return
    }
    // Two loads can overlap (the second `load()` clears `ad`, but the first request may still land
    // afterwards), so an earlier ad can be sitting here. Clear its delegate and paid closure
    // before replacing it, or it keeps firing events into this object. Safe here only because the
    // guard above has ruled out a presentation in flight.
    tearDownAd()
    // `fullScreenContentDelegate` is a weak property; the proxy is retained by `FullScreenAd`.
    ad.fullScreenContentDelegate = delegateProxy
    // Paid events arrive through this closure property, not through the delegate.
    ad.paidEventHandler = { [weak self] value in
      self?.emitPaid(value)
    }
    self.ad = ad
    handleLoaded(responseInfo: ad.responseInfo)
  }

  @MainActor
  override func presentAd(from viewController: UIViewController) -> Bool {
    guard let ad else { return false }
    // Returns void and never throws: a failed presentation is reported asynchronously through
    // `ad(_:didFailToPresentFullScreenContentWithError:)`.
    ad.present(from: viewController)
    return true
  }

  override func tearDownAd() {
    ad?.fullScreenContentDelegate = nil
    ad?.paidEventHandler = nil
    ad = nil
  }
}
