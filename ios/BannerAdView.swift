import ExpoModulesCore

/// 広告を表示する View。マウント時にネイティブ `BannerView` を addSubview し、
/// アンマウント時は removeFromSuperview するだけ — 広告（`BannerAd`）自体は破棄しない。
final class BannerAdView: ExpoView {
  private var currentAd: BannerAd?

  func setAd(_ ad: BannerAd?) {
    // `currentAd === ad` だけでは不十分: 別の View にこの広告を奪われた後、
    // 同じ ad が再び props で渡ってきても（`ad.bannerView.superview` が自分ではなくなっている
    // ため）二度と取り戻せず、この View が永久に空白のままになってしまう
    // （実際に自分がまだ画面に出しているときだけ早期リターンする）。
    if currentAd === ad, ad?.bannerView?.superview === self {
      return
    }
    detachCurrentAdIfOwned()
    currentAd = ad

    // `ad.bannerView` は release() 済みなら nil を返す。その場合は表示するものが無いので、
    // 空のバナーを作り直してマウントしたりはしない（release 後にこの ad をまだ保持している
    // View が再度 props を受け取ってしまうケースへの対処）。
    guard let ad, let bannerView = ad.bannerView else { return }

    // 別の View がまだこの広告の所有者として記録されていて、かつ実際に画面（window）に
    // 乗っているときだけ警告する。`deinit` のタイミングは不定なので、単なる再マウント
    // （古い View インスタンスがまだ解放されていないだけ）では所有権 or window のどちらかが
    // 外れており、警告は鳴らない。両方 true のときだけが本当の「同時使用」。
    if let otherOwner = ad.currentAttachment, otherOwner !== self, bannerView.window != nil {
      log.warn(
        "同じ広告が複数の BannerAdView に渡されています。最後にマウントされた View にのみ表示されます。"
      )
    }
    bannerView.removeFromSuperview()
    // このバージョンの ExpoView (ExpoFabricView) には `reactViewController()` が無いため、
    // `appContext.utilities.currentViewController()` で表示中の view controller を取得する。
    // （`load()` 時にも都度解決し直しているので、ここでの設定はマウント直後の表示に効く。）
    bannerView.rootViewController = appContext?.utilities?.currentViewController()
    ad.currentAttachment = self
    addSubview(bannerView)
  }

  /// 自分がまだこの広告の所有者である場合のみ View から外す。
  /// 既に別の View に奪われている場合は何もしない（奪い返さない）。
  private func detachCurrentAdIfOwned() {
    guard let currentAd, currentAd.currentAttachment === self else { return }
    currentAd.bannerView?.removeFromSuperview()
    currentAd.currentAttachment = nil
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    // 所有権を失っている（別の View に奪われた）場合はフレームを触らない。
    // でないと、奪われた後の古い View がレイアウトされるたびに、今は別の View が
    // 表示している広告のフレームを書き換えてしまう。
    guard let currentAd, currentAd.currentAttachment === self else { return }
    currentAd.bannerView?.frame = bounds
  }

  deinit {
    // 広告は破棄しない。自分がまだ所有者の場合のみ View から外す。
    // deinit はメインスレッドで呼ばれるとは限らないため、UIKit に触れる処理は
    // runOnMain で明示的にメインスレッドへ同期する。
    guard let currentAd else { return }
    runOnMain {
      guard currentAd.currentAttachment === self else { return }
      currentAd.bannerView?.removeFromSuperview()
      currentAd.currentAttachment = nil
    }
  }
}
