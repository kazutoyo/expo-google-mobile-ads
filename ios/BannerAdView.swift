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
    // `detachCurrentAdIfOwned()` above already cleared our own ownership, so any owner still
    // recorded here is another view. Remember it so the ad can be handed back when we go away.
    let otherOwner = ad.currentAttachment
    if let otherOwner, otherOwner !== self, bannerView.window != nil {
      log.warn(
        "同じ広告が複数の BannerAdView に渡されています。最後にマウントされた View にのみ表示されます。"
      )
    }
    ad.previousAttachment = otherOwner
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
    // 所有権を失っている（別の View に奪われた）場合はフレームを触らない。
    // でないと、奪われた後の古い View がレイアウトされるたびに、今は別の View が
    // 表示している広告のフレームを書き換えてしまう。
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
