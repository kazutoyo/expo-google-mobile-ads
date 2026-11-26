package expo.modules.googlemobileads

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.text.TextUtils
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import com.google.android.libraries.ads.mobile.sdk.nativead.MediaView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import java.lang.ref.WeakReference
import com.google.android.libraries.ads.mobile.sdk.nativead.NativeAd as GmaNativeAd
import com.google.android.libraries.ads.mobile.sdk.nativead.NativeAdView as GmaNativeAdView

enum class NativeAdLayout(val value: String) {
  CARD("card"),
  FULL_SCREEN("fullScreen"),
}

class NativeAdCardView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  override val shouldUseAndroidLayout = true
  private var currentAd: NativeAd? = null
  private var card: GmaNativeAdView? = null
  private var layout = NativeAdLayout.CARD
  private var bottomInset = 0.0

  fun setAd(ad: NativeAd?) {
    if (currentAd === ad && card != null) return
    if (currentAd?.attachment?.get() === this) currentAd?.attachment = null
    ad?.attachment?.get()?.takeIf { it !== this }?.setAd(null)
    currentAd = ad
    ad?.attachment = WeakReference(this)
    refresh()
  }

  fun setLayout(layout: NativeAdLayout) {
    if (this.layout == layout) return
    this.layout = layout
    refresh()
  }

  fun setBottomInset(bottomInset: Double) {
    if (this.bottomInset == bottomInset) return
    this.bottomInset = bottomInset
    if (layout == NativeAdLayout.FULL_SCREEN) refresh()
  }

  fun refresh() {
    // Recreate the asset container to unregister the previous ad completely.
    card?.let { removeView(it); it.destroy() }
    card = null
    val ad = currentAd?.ad ?: return
    val view = GmaNativeAdView(context)
    val media = when (layout) {
      NativeAdLayout.CARD -> buildCardLayout(view, ad)
      NativeAdLayout.FULL_SCREEN -> buildFullScreenLayout(view, ad)
    }
    view.registerNativeAd(ad, media)
    card = view
    addView(view, ViewGroup.LayoutParams(-1, -1))
    requestLayout()
  }

  fun onDestroy() { setAd(null) }

  private fun buildCardLayout(view: GmaNativeAdView, ad: GmaNativeAd): MediaView {
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
    return media
  }

  /** Media fills the view. A gradient and an install card sit at the bottom, the card above `bottomInset`. */
  private fun buildFullScreenLayout(view: GmaNativeAdView, ad: GmaNativeAd): MediaView {
    val root = FrameLayout(context)
    view.addView(root, ViewGroup.LayoutParams(-1, -1))
    val media = MediaView(context).apply { imageScaleType = ImageView.ScaleType.FIT_CENTER }
    root.addView(media, FrameLayout.LayoutParams(-1, -1))
    val gradient = View(context).apply {
      background = GradientDrawable(
        GradientDrawable.Orientation.BOTTOM_TOP,
        intArrayOf(Color.argb(0x8C, 0, 0, 0), Color.TRANSPARENT),
      )
    }
    root.addView(gradient, FrameLayout.LayoutParams(-1, dp(180), Gravity.BOTTOM))
    val installCard = LinearLayout(context).apply {
      gravity = Gravity.CENTER_VERTICAL
      val padding = dp(12)
      setPadding(padding, padding, padding, padding)
      background = GradientDrawable().apply {
        setColor(themeColor(android.R.attr.colorBackground))
        cornerRadius = dp(12).toFloat()
      }
      elevation = dp(2).toFloat()
    }
    root.addView(
      installCard,
      FrameLayout.LayoutParams(-1, -2, Gravity.BOTTOM).apply {
        marginStart = dp(16)
        marginEnd = dp(16)
        bottomMargin = dp(bottomInset) + dp(8)
      },
    )
    val icon = ImageView(context).apply {
      setImageDrawable(ad.icon?.drawable)
      visibility = if (ad.icon == null) View.GONE else View.VISIBLE
    }
    installCard.addView(icon, LinearLayout.LayoutParams(dp(48), dp(48)))
    val texts = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }
    installCard.addView(
      texts,
      LinearLayout.LayoutParams(0, -2, 1f).apply {
        gravity = Gravity.TOP
        marginStart = dp(12)
      },
    )
    val headline = TextView(context).apply {
      text = ad.headline
      textSize = 15f
      setTypeface(typeface, Typeface.BOLD)
      maxLines = 1
      ellipsize = TextUtils.TruncateAt.END
      setTextColor(themeColor(android.R.attr.textColorPrimary))
    }
    texts.addView(headline, LinearLayout.LayoutParams(-1, -2))
    val body = TextView(context).apply {
      text = ad.body
      textSize = 12f
      maxLines = 2
      ellipsize = TextUtils.TruncateAt.END
      setTextColor(themeColor(android.R.attr.textColorSecondary))
      visibility = if (ad.body == null) View.INVISIBLE else View.VISIBLE
    }
    texts.addView(body, LinearLayout.LayoutParams(-1, -2))
    val cta = Button(context).apply {
      text = ad.callToAction
      setTextColor(Color.WHITE)
      setTypeface(typeface, Typeface.BOLD)
      background = GradientDrawable().apply {
        setColor(Color.parseColor("#1E88FF"))
        cornerRadius = dp(16).toFloat()
      }
      stateListAnimator = null
      setPadding(dp(16), 0, dp(16), 0)
      visibility = if (ad.callToAction == null) View.INVISIBLE else View.VISIBLE
    }
    installCard.addView(cta, LinearLayout.LayoutParams(-2, dp(40)))
    view.headlineView = headline
    view.iconView = icon
    view.bodyView = body
    view.callToActionView = cta
    return media
  }

  private fun themeColor(attribute: Int): Int {
    val attributes = context.obtainStyledAttributes(intArrayOf(attribute))
    val color = attributes.getColor(0, Color.TRANSPARENT)
    attributes.recycle()
    return color
  }

  private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
  private fun dp(value: Double) = (value * resources.displayMetrics.density).toInt()
}
