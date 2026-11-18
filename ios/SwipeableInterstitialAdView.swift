import ExpoModulesCore

final class SwipeableInterstitialAdView: ExpoView {
  private var currentAd: EmbeddedSwipeableInterstitialAd?

  func setAd(_ ad: EmbeddedSwipeableInterstitialAd?) {
    if currentAd !== ad, currentAd?.attachment === self {
      currentAd?.adView?.removeFromSuperview()
      currentAd?.attachment = nil
    }
    currentAd = ad
    guard let ad else { return }
    ad.attachment = self
    refresh()
  }

  func refresh() {
    guard let ad = currentAd, ad.attachment === self, let view = ad.adView else { return }
    if view.superview !== self {
      view.removeFromSuperview()
      addSubview(view)
    }
    ad.attachRootViewController(appContext?.utilities?.currentViewController())
    setNeedsLayout()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    guard currentAd?.attachment === self else { return }
    currentAd?.adView?.frame = bounds
  }
}
