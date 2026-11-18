package expo.modules.googlemobileads

import android.os.Handler
import android.os.Looper
import com.google.android.libraries.ads.mobile.sdk.common.AdValue
import com.google.android.libraries.ads.mobile.sdk.common.LoadAdError
import com.google.android.libraries.ads.mobile.sdk.nativead.NativeAdEventCallback
import com.google.android.libraries.ads.mobile.sdk.nativead.NativeAdLoader
import com.google.android.libraries.ads.mobile.sdk.nativead.NativeAdLoaderCallback
import com.google.android.libraries.ads.mobile.sdk.nativead.NativeAdRequest
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.sharedobjects.SharedObject
import java.lang.ref.WeakReference
import com.google.android.libraries.ads.mobile.sdk.nativead.NativeAd as GmaNativeAd

class NativeAd(
  appContext: AppContext,
  private val adUnitId: String,
  private val requestOptions: Map<String, Any?>?
) : SharedObject(appContext) {
  private val handler = Handler(Looper.getMainLooper())
  @Volatile private var released = false
  @Volatile private var snapshot: Map<String, Any?> = mapOf("status" to "loading")
  private var generation = 0
  var ad: GmaNativeAd? = null
    private set
  var attachment: WeakReference<NativeAdCardView>? = null
  val status: String get() = snapshot["status"] as String
  val error: Any? get() = snapshot["error"]
  val responseInfo: Any? get() = snapshot["responseInfo"]
  val assets: Any? get() = snapshot["assets"]

  private fun update(values: Map<String, Any?>) {
    snapshot = values
    emit("statusChange", values)
    attachment?.get()?.refresh()
  }

  fun load() {
    handler.post {
      if (released) return@post
      val loadId = ++generation
      clearAd()
      update(mapOf("status" to "loading"))
      val builder = NativeAdRequest.Builder(adUnitId, listOf(GmaNativeAd.NativeAdType.NATIVE))
      (requestOptions?.get("keywords") as? List<*>)?.filterIsInstance<String>()?.forEach { builder.addKeyword(it) }
      (requestOptions?.get("contentUrl") as? String)?.let { builder.setContentUrl(it) }
      NativeAdLoader.load(builder.build(), object : NativeAdLoaderCallback {
        override fun onNativeAdLoaded(loaded: GmaNativeAd) {
          handler.post {
            if (released || loadId != generation) { loaded.destroy(); return@post }
            ad = loaded
            loaded.adEventCallback = object : NativeAdEventCallback {
              override fun onAdImpression() { emit("impression") }
              override fun onAdClicked() { emit("clicked") }
              override fun onAdPaid(value: AdValue) { emit("paid", value.toPaidEventMap()) }
            }
            update(mapOf("status" to "loaded", "responseInfo" to loaded.getResponseInfo().toMap(),
              "assets" to mapOf("headline" to loaded.headline, "body" to loaded.body,
                "callToAction" to loaded.callToAction, "advertiser" to loaded.advertiser,
                "starRating" to loaded.starRating, "store" to loaded.store, "price" to loaded.price,
                "mediaAspectRatio" to (loaded.mediaContent?.aspectRatio ?: 0f))))
          }
        }
        override fun onAdFailedToLoad(error: LoadAdError) {
          handler.post {
            if (!released && loadId == generation) update(mapOf("status" to "error", "error" to error.toMap()))
          }
        }
      })
    }
  }

  fun markLoadFailed(message: String) {
    handler.post {
      if (released) return@post
      generation++
      clearAd()
      update(mapOf("status" to "error", "error" to mapOf("code" to -1, "message" to message, "domain" to "ExpoGoogleMobileAds")))
    }
  }

  private fun clearAd() {
    val previous = ad
    ad = null
    attachment?.get()?.refresh()
    previous?.adEventCallback = null
    previous?.destroy()
  }

  override fun sharedObjectDidRelease() {
    released = true
    handler.post { generation++; clearAd() }
  }
}
