package expo.modules.googlemobileads

import android.content.Context
import android.util.Log
import android.view.View.MeasureSpec
import android.view.ViewGroup
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

private const val TAG = "ExpoGoogleMobileAds"

/**
 * 広告を表示する View。マウント時にネイティブ `AdView` を addView し、アンマウント時は
 * removeView するだけ — 広告（`BannerAd`）自体は破棄しない（[Lesson 7]）。
 *
 * Expo/RN の View prop 適用・レイアウト・ライフサイクルコールバックはすべて UI スレッドで
 * 実行されるため、このクラスのメソッドはどれもスレッドホップ不要（`BannerAd` 側の
 * `load()`/`sharedObjectDidRelease()` とは異なり、常に main スレッド上で呼ばれる）。
 *
 * [Review fix — C3] `onDetachedFromWindow()` での teardown は意図的に実装しない。
 * `react-native-screens` は非アクティブな画面をデフォルトで「破棄」ではなく
 * 「window から detach」するだけであり、この View インスタンス自体は生き続ける
 * （後で同じ window に再 attach される）。`onDetachedFromWindow` は画面遷移による
 * 一時的な detach と本当の unmount を区別できないため、ここで `AdView` を
 * removeView すると、画面へ戻ってきたときに `ad` prop の参照が変わらない限り
 * `setAd()` は再呼び出しされず（Fabric は参照が変化しないプロパティを再適用しない）、
 * 誰も再度 addView しないまま永久に空白になる。iOS 側にも window-detach 相当の
 * teardown フックは存在しない（本当の破棄は `prepareForRecycle()` で拾っている）ため、
 * ここでは iOS に合わせて何もしない。
 *
 * これで「本当に別の View にこの広告を奪われる」ケースの後始末が漏れることはない:
 * `setAd()` は所有権の有無に関わらず `(view.parent as? ViewGroup)?.removeView(view)` を
 * 呼んでから addView するため、奪う側の `setAd()` 自体が古い親からの取り外しを保証する。
 *
 * [Review fix round 3 — item 3] 「本当に unmount された（が別 View にも奪われず
 * release() もされていない）」ケースは `OnViewDestroys`（`ExpoGoogleMobileAdsModule.kt`
 * の `View(BannerAdView::class)` ブロック）で拾う。これは `onDropViewInstance` から
 * 呼ばれる本物の破棄フックであり、`react-native-screens` の一時的な window detach
 * では発火しない（`onDetachedFromWindow` とは別物）ため、上記の判断とは矛盾しない。
 */
class BannerAdView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private var currentAd: BannerAd? = null

  // ExpoView (LinearLayout) は Yoga 管理下に無い子 View を addView しても、デフォルトでは
  // requestLayout() をトリガーに再レイアウトしてくれない（ExpoView.kt のコメント参照）。
  // このフラグを立てることで requestLayout() のたびに measureAndLayout() が post され、
  // 自分自身の onMeasure/onLayout が確実に呼ばれるようになる。
  override val shouldUseAndroidLayout: Boolean = true

  fun setAd(ad: BannerAd?) {
    // [Review fix — I1] `load()` を待たず、この View がマウントされた時点で Activity が
    // 解決できるなら AdView を作ってしまう（iOS が setAd 内で遅延生成するのと同じ設計）。
    // BannerAdView は React Native の実 View としてしか存在し得ず、マウントされる時点で
    // 必ずそれをホストする Activity が存在するため、この呼び出しはほぼ確実に成功する。
    val view = ad?.ensureAdView()

    // [Lesson 5 — 奪われた広告を見捨てない]
    // `currentAd === ad` だけでは不十分: 別の View にこの広告を奪われた後、同じ ad が
    // 再び props で渡ってきても（`view` の parent が自分ではなくなっているため）
    // 二度と取り戻せず、この View が永久に空白のままになってしまう
    // （実際に自分がまだ画面に出しているときだけ早期リターンする）。
    if (currentAd === ad && view != null && view.parent === this) {
      return
    }
    detachIfOwned()
    currentAd = ad

    // `ensureAdView()` が null を返すのは Activity が本当に無い場合と release() 済みの
    // 場合のみ。その場合は表示するものが無いので何もしない。
    if (ad == null || view == null) return

    // 別の View がまだこの広告の所有者として記録されていて、かつ実際に画面（window）に
    // 乗っているときだけ警告する。GC のタイミングは不定なので、単なる再マウント
    // （古い View インスタンスがまだ回収されていないだけ）では所有権 or window の
    // どちらかが外れており、警告は鳴らない。両方 true のときだけが本当の「同時使用」。
    // `detachIfOwned()` above already cleared our own ownership, so any owner left here is
    // another view. Remember it so the ad can go back when we give it up.
    val otherOwner = ad.currentAttachment
    if (otherOwner != null && otherOwner !== this && view.isAttachedToWindow) {
      Log.w(
        TAG,
        "同じ広告が複数の BannerAdView に渡されています。最後にマウントされた View にのみ表示されます。"
      )
    }
    ad.previousAttachment = otherOwner
    (view.parent as? ViewGroup)?.removeView(view)
    ad.currentAttachment = this
    addView(view, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
    requestLayout()
  }

  /**
   * 自分がまだこの広告の所有者である場合のみ View から外す。既に別の View に奪われている
   * 場合は何もしない（奪い返さない）。`setAd()` の再割り当て時と、`onDestroy()`
   * （この View が本当に破棄されるとき、[Review fix round 3 — item 3]）の両方から呼ぶ。
   */
  private fun detachIfOwned() {
    val ad = currentAd ?: return
    if (ad.currentAttachment !== this) return
    ad.adView?.let { removeView(it) }
    ad.currentAttachment = null
    handBackToPreviousOwner(ad)
  }

  /**
   * Gives an ad that just became unowned back to the view it was taken from, as long as that view
   * is still alive and still wants it (`currentAd === ad`). `setAd()` re-runs the normal attach
   * path, so the reclaiming view becomes the owner again and shows the banner.
   */
  private fun handBackToPreviousOwner(ad: BannerAd) {
    val previous = ad.previousAttachment ?: return
    if (previous === this || previous.currentAd !== ad) return
    // Cleared first so the re-attach below cannot bounce the ad back and forth.
    ad.previousAttachment = null
    previous.setAd(ad)
  }

  /**
   * Called from `OnViewDestroys` (`onDropViewInstance`), the real teardown hook — it does not fire
   * on the temporary window detaches `react-native-screens` performs during screen transitions.
   * Giving up the ad here is what lets another still-mounted view reclaim it; dropping `currentAd`
   * keeps a destroyed instance from being handed the ad back later. iOS does the same in
   * `prepareForRecycle()`.
   */
  internal fun onDestroy() {
    detachIfOwned()
    val ad = currentAd ?: return
    if (ad.previousAttachment === this) ad.previousAttachment = null
    currentAd = null
  }

  override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
    super.onLayout(changed, l, t, r, b)
    // 所有権を失っている（別の View に奪われた）場合は AdView に触れない。でないと、
    // 奪われた後の古い View がレイアウトされるたびに、今は別の View が表示している
    // 広告のフレームを書き換えてしまう。
    val ad = currentAd ?: return
    if (ad.currentAttachment !== this) return
    val view = ad.adView ?: return
    view.measure(
      MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
      MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY)
    )
    view.layout(0, 0, width, height)
  }
}
