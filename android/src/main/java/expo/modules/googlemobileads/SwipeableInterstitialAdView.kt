package expo.modules.googlemobileads

import android.content.Context
import android.view.View
import android.view.ViewGroup
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import java.lang.ref.WeakReference

class SwipeableInterstitialAdView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private var currentAd: SwipeableInterstitialAd? = null
  override val shouldUseAndroidLayout = true

  fun setAd(ad: SwipeableInterstitialAd?) {
    if (currentAd !== ad && currentAd?.attachment?.get() === this) {
      currentAd?.detachView(this)
      currentAd?.attachment = null
    }
    currentAd = ad
    ad?.attachment = WeakReference(this)
    refresh()
  }

  fun refresh() {
    val ad = currentAd ?: return
    if (ad.attachment?.get() !== this) return
    val activity = appContext.currentActivity ?: return
    val view = ad.getView(activity) ?: return
    if (view.parent !== this) {
      (view.parent as? ViewGroup)?.removeView(view)
      addView(view, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
    }
    requestLayout()
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    refresh()
  }

  fun onDestroy() {
    setAd(null)
  }

  override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
    super.onLayout(changed, l, t, r, b)
    if (currentAd?.attachment?.get() !== this) return
    for (index in 0 until childCount) {
      getChildAt(index).apply {
        measure(View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
                View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY))
        layout(0, 0, width, height)
      }
    }
  }
}
