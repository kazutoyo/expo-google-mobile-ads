package expo.modules.googlemobileads

import android.content.Context
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import com.google.android.libraries.ads.mobile.sdk.nativead.MediaView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import java.lang.ref.WeakReference
import com.google.android.libraries.ads.mobile.sdk.nativead.NativeAdView as GmaNativeAdView

class NativeAdCardView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  override val shouldUseAndroidLayout = true
  private var currentAd: NativeAd? = null
  private var card: GmaNativeAdView? = null

  fun setAd(ad: NativeAd?) {
    if (currentAd === ad && card != null) return
    if (currentAd?.attachment?.get() === this) currentAd?.attachment = null
    ad?.attachment?.get()?.takeIf { it !== this }?.setAd(null)
    currentAd = ad
    ad?.attachment = WeakReference(this)
    refresh()
  }

  fun refresh() {
    // Recreate the asset container to unregister the previous ad completely.
    card?.let { removeView(it); it.destroy() }
    card = null
    val ad = currentAd?.ad ?: return
    val view = GmaNativeAdView(context)
    val column = LinearLayout(context).apply {
      orientation = LinearLayout.VERTICAL
      val padding = dp(12)
      setPadding(padding, padding, padding, padding)
    }
    view.addView(column, ViewGroup.LayoutParams(-1, -1))
    fun label(value: String?, size: Float): TextView = TextView(context).apply {
      text = value
      textSize = size
      visibility = if (value == null) View.GONE else View.VISIBLE
      column.addView(this, LinearLayout.LayoutParams(-1, -2))
    }
    label("Ad", 12f)
    val header = LinearLayout(context)
    column.addView(header, LinearLayout.LayoutParams(-1, dp(40)))
    val icon = ImageView(context).apply {
      setImageDrawable(ad.icon?.drawable)
      visibility = if (ad.icon == null) View.GONE else View.VISIBLE
      scaleType = ImageView.ScaleType.FIT_CENTER
    }
    header.addView(icon, LinearLayout.LayoutParams(dp(40), dp(40)))
    val headline = TextView(context).apply { text = ad.headline; textSize = 17f; setTypeface(typeface, 1) }
    header.addView(headline, LinearLayout.LayoutParams(0, -1, 1f))
    val advertiser = label(ad.advertiser, 14f)
    val media = MediaView(context)
    column.addView(media, LinearLayout.LayoutParams(-1, 0, 1f))
    val body = label(ad.body, 14f).apply { maxLines = 2 }
    val cta = Button(context).apply {
      text = ad.callToAction
      visibility = if (ad.callToAction == null) View.GONE else View.VISIBLE
    }
    column.addView(cta, LinearLayout.LayoutParams(-1, -2))
    view.headlineView = headline
    view.iconView = icon
    view.advertiserView = advertiser
    view.bodyView = body
    view.callToActionView = cta
    view.registerNativeAd(ad, media)
    card = view
    addView(view, ViewGroup.LayoutParams(-1, -1))
    requestLayout()
  }

  fun onDestroy() { setAd(null) }
  private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}
