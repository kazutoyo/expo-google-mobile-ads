import ExpoModulesCore

/// The view that displays an ad. addSubviews the native `BannerView` on mount and only
/// removeFromSuperview on unmount — the ad (`BannerAd`) itself is never destroyed.
final class BannerAdView: ExpoView {
  private var currentAd: BannerAd?

  func setAd(_ ad: BannerAd?) {
    // `currentAd === ad` alone isn't enough: once another View has taken this ad, the same ad
    // coming back through props (`ad.bannerView.superview` is no longer self) can never be
    // reclaimed, leaving this View permanently blank
    // (the early return only fires when this view is actually still the one on screen).
    if currentAd === ad, ad?.bannerView?.superview === self {
      return
    }
    detachCurrentAdIfOwned()
    currentAd = ad

    // `ad.bannerView` returns nil once release()d. In that case there's nothing to show, so
    // don't recreate and mount an empty banner (this guards against a View that still holds
    // this ad after release receiving props again).
    guard let ad, let bannerView = ad.bannerView else { return }

    // Only warn when another View is still recorded as this ad's owner AND it's actually on
    // screen (attached to a window). `deinit` timing is indeterminate, so a plain remount
    // (the old View instance just hasn't been deallocated yet) will have either ownership or
    // window detached, and won't warn. Only when both are true is it a real "simultaneous use".
    // `detachCurrentAdIfOwned()` above already cleared our own ownership, so any owner still
    // recorded here is another view. Remember it so the ad can be handed back when we go away.
    let otherOwner = ad.currentAttachment
    if let otherOwner, otherOwner !== self, bannerView.window != nil {
      log.warn(
        "The same ad was passed to multiple BannerAdViews. Only the most recently mounted View will display it."
      )
    }
    ad.previousAttachment = otherOwner
    bannerView.removeFromSuperview()
    // This version of ExpoView (ExpoFabricView) has no `reactViewController()`, so get the
    // currently-visible view controller via `appContext.utilities.currentViewController()`.
    // (This is also resolved fresh on every `load()` call, so setting it here matters for
    // display right after mount.)
    bannerView.rootViewController = appContext?.utilities?.currentViewController()
    ad.currentAttachment = self
    addSubview(bannerView)
  }

  /// Removes the ad from the view only if this view is still its owner.
  /// Does nothing if it has already been taken by another view (doesn't steal it back).
  ///
  /// Only called from `setAd()`'s reassignment path, so it must NOT hand the ad back to
  /// `previousAttachment` — that would fire for a view that is about to re-take the ad two lines
  /// later (re-applying the same ad while it isn't currently this view's subview), producing a
  /// spurious "same ad in two views" warning and a needless detach/attach churn for no real
  /// ownership change. `deinit` below is the only place a real give-up is handled. [Review fix — F5]
  private func detachCurrentAdIfOwned() {
    guard let currentAd, currentAd.currentAttachment === self else { return }
    currentAd.bannerView?.removeFromSuperview()
    currentAd.currentAttachment = nil
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    // Don't touch the frame if ownership has been lost (taken by another View). Otherwise,
    // every time the old View that lost ownership gets laid out, it would overwrite the frame
    // of the ad that's now being displayed by a different View.
    guard let currentAd, currentAd.currentAttachment === self else { return }
    currentAd.bannerView?.frame = bounds
  }

  /// `deinit` does **no** teardown — that part is still automatic and is deliberately not
  /// re-introduced here:
  /// - `bannerView` is this view's subview, so it leaves the hierarchy when this view is freed.
  /// - `currentAttachment` is `weak`, so it clears itself when this view is freed.
  ///
  /// What `deinit` *is* good for is handing a stolen ad back. This is the only signal iOS gives
  /// that this view is really gone: RN 0.86 never calls `prepareForRecycle` on an Expo Fabric
  /// view (verified on the simulator — only `didMoveToWindow(window: nil)` and `deinit` fire on
  /// unmount), and `didMoveToWindow` cannot be used because `react-native-screens` detaches
  /// inactive screens from the window without unmounting them. It is the counterpart of
  /// Android's `OnViewDestroys` hook.
  ///
  /// The old ownership check (`currentAd.currentAttachment === self`) was dead code here because
  /// a weak read of a deallocating `self` returns nil — which is exactly what makes the handback
  /// work: seeing no owner means the ad became unowned along with us.
  deinit {
    guard let ad = currentAd else { return }
    // `deinit` is not actor-isolated and the re-attach touches UIKit, so hop to the main queue.
    // The closure retains `ad`, keeping it (and its `previousAttachment`) alive until this runs —
    // it does NOT keep the candidate view reachable. `previousAttachment` is `weak`, so if that
    // view has already been deallocated by the time this runs, the read below simply yields `nil`
    // and the guard fails safely; nothing here extends that view's lifetime.
    DispatchQueue.main.async {
      guard ad.currentAttachment == nil,
            let previous = ad.previousAttachment,
            previous.currentAd === ad
      else {
        return
      }
      ad.previousAttachment = nil
      previous.setAd(ad)
    }
  }
}
