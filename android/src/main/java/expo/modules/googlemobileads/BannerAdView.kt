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
 */
class BannerAdView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private var currentAd: BannerAd? = null

  // ExpoView (LinearLayout) は Yoga 管理下に無い子 View を addView しても、デフォルトでは
  // requestLayout() をトリガーに再レイアウトしてくれない（ExpoView.kt のコメント参照）。
  // このフラグを立てることで requestLayout() のたびに measureAndLayout() が post され、
  // 自分自身の onMeasure/onLayout が確実に呼ばれるようになる。
  override val shouldUseAndroidLayout: Boolean = true

  fun setAd(ad: BannerAd?) {
    // [Lesson 5 — 奪われた広告を見捨てない]
    // `currentAd === ad` だけでは不十分: 別の View にこの広告を奪われた後、同じ ad が
    // 再び props で渡ってきても（`ad.adView` の parent が自分ではなくなっているため）
    // 二度と取り戻せず、この View が永久に空白のままになってしまう
    // （実際に自分がまだ画面に出しているときだけ早期リターンする）。
    if (currentAd === ad && ad?.adView?.parent === this) {
      return
    }
    detachCurrentAdIfOwned()
    currentAd = ad

    // `ad.adView` はまだ Activity が解決できておらず作られていない場合がある（プリロード中
    // など）。その場合は表示するものが無いので、空の AdView を作り直してマウントしたりは
    // しない。`release()` 済みの場合も同様に null のまま。
    val view = ad?.adView ?: return

    // 別の View がまだこの広告の所有者として記録されていて、かつ実際に画面（window）に
    // 乗っているときだけ警告する。GC のタイミングは不定なので、単なる再マウント
    // （古い View インスタンスがまだ回収されていないだけ）では所有権 or window の
    // どちらかが外れており、警告は鳴らない。両方 true のときだけが本当の「同時使用」。
    val otherOwner = ad.currentAttachment
    if (otherOwner != null && otherOwner !== this && view.isAttachedToWindow) {
      Log.w(
        TAG,
        "同じ広告が複数の BannerAdView に渡されています。最後にマウントされた View にのみ表示されます。"
      )
    }
    (view.parent as? ViewGroup)?.removeView(view)
    ad.currentAttachment = this
    addView(view, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
    requestLayout()
  }

  /** 自分がまだこの広告の所有者である場合のみ View から外す。既に別の View に奪われている場合は何もしない（奪い返さない）。 */
  private fun detachCurrentAdIfOwned() {
    val ad = currentAd ?: return
    if (ad.currentAttachment !== this) return
    ad.adView?.let { removeView(it) }
    ad.currentAttachment = null
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

  override fun onDetachedFromWindow() {
    super.onDetachedFromWindow()
    // 広告は破棄しない。自分がまだ所有者の場合のみ View から外す。
    detachCurrentAdIfOwned()
  }
}
