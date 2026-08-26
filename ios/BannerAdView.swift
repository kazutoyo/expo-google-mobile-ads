import ExpoModulesCore

/// 広告を表示する View。マウント時にネイティブ `BannerView` を addSubview し、
/// アンマウント時は removeFromSuperview するだけ — 広告（`BannerAd`）自体は破棄しない。
final class BannerAdView: ExpoView {
  private var currentAd: BannerAd?

  func setAd(_ ad: BannerAd?) {
    if currentAd === ad { return }
    currentAd?.bannerView.removeFromSuperview()
    currentAd = ad

    guard let ad else { return }
    // 他の View に載ったままなら外す（後勝ち）
    if ad.bannerView.superview != nil {
      log.warn(
        "同じ広告が複数の BannerAdView に渡されています。最後にマウントされた View にのみ表示されます。"
      )
      ad.bannerView.removeFromSuperview()
    }
    // このバージョンの ExpoView (ExpoFabricView) には `reactViewController()` が無いため、
    // `appContext.utilities.currentViewController()` で表示中の view controller を取得する。
    ad.bannerView.rootViewController = appContext?.utilities?.currentViewController()
    addSubview(ad.bannerView)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    currentAd?.bannerView.frame = bounds
  }

  deinit {
    // 広告は破棄しない。View から外すだけ。
    currentAd?.bannerView.removeFromSuperview()
  }
}
