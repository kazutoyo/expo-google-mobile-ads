@file:OptIn(com.google.android.libraries.ads.mobile.sdk.common.ExperimentalApi::class)

package expo.modules.googlemobileads

import android.app.Activity
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import com.google.android.libraries.ads.mobile.sdk.common.AdLoadCallback
import com.google.android.libraries.ads.mobile.sdk.common.AdValue
import com.google.android.libraries.ads.mobile.sdk.common.LoadAdError
import com.google.android.libraries.ads.mobile.sdk.swipeableinterstitial.SwipeableInterstitialAdEventCallback
import com.google.android.libraries.ads.mobile.sdk.swipeableinterstitial.SwipeableInterstitialAdRequest
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.sharedobjects.SharedObject
import java.lang.ref.WeakReference
import com.google.android.libraries.ads.mobile.sdk.swipeableinterstitial.SwipeableInterstitialAd as GmaSwipeableInterstitialAd

class SwipeableInterstitialAd(
  appContext: AppContext,
  private val adUnitId: String,
  private val size: Map<String, Double>?,
  private val maxScreenHoldDuration: Int,
  private val requestOptions: Map<String, Any?>?
) : SharedObject(appContext) {
  // Atomically publish a snapshot; JS getters never block on the UI thread.
  private data class State(
    val status: String = "loading",
    val error: Map<String, Any?>? = null,
    val responseInfo: Map<String, Any?>? = null,
    val hold: Int = 0
  )
  @Volatile private var state = State()
  val status get() = state.status
  val error get() = state.error
  val responseInfo get() = state.responseInfo
  val minScreenHoldDuration get() = state.hold
  private val main = Handler(Looper.getMainLooper())
  private var ad: GmaSwipeableInterstitialAd? = null
  private var view: View? = null
  private var released = false
  private var loadId = 0L
  var attachment: WeakReference<SwipeableInterstitialAdView>? = null

  fun load() {
    main.post {
      if (released) return@post
      val requestId = ++loadId
      tearDown()
      update(State())
      try {
        val request = SwipeableInterstitialAdRequest.Builder(adUnitId)
          .setMaxScreenHoldDurationSeconds(maxScreenHoldDuration)
        size?.let { request.setAdSize(it.getValue("width").toInt(), it.getValue("height").toInt()) }
        (requestOptions?.get("keywords") as? List<*>)?.filterIsInstance<String>()?.forEach { request.addKeyword(it) }
        (requestOptions?.get("contentUrl") as? String)?.let { request.setContentUrl(it) }
        GmaSwipeableInterstitialAd.load(request.build(), object : AdLoadCallback<GmaSwipeableInterstitialAd> {
          override fun onAdLoaded(ad: GmaSwipeableInterstitialAd) {
            val loaded = ad
            main.post loadedResult@{
              if (released || requestId != loadId) {
                loaded.destroy()
                return@loadedResult
              }
              this@SwipeableInterstitialAd.ad = loaded
              loaded.adEventCallback = object : SwipeableInterstitialAdEventCallback {
                private fun event(name: String, payload: Map<String, Any?> = emptyMap()) {
                  main.post { if (!released && this@SwipeableInterstitialAd.ad === loaded) emit(name, payload) }
                }
                override fun onAdImpression() = event("impression")
                override fun onAdClicked() = event("clicked")
                override fun onAdPaid(value: AdValue) = event("paid", value.toPaidEventMap())
                override fun onAdShowedFullScreenContent() = event("screenPresented")
                override fun onAdDismissedFullScreenContent() = event("screenDismissed")
                override fun onAdScreenHoldTimerStarted() = event("screenHoldTimerStarted")
              }
              update(State("loaded", responseInfo = loaded.getResponseInfo().toMap(), hold = loaded.getScreenHoldDuration()))
              attachment?.get()?.refresh()
            }
          }
          override fun onAdFailedToLoad(adError: LoadAdError) {
            main.post { if (!released && requestId == loadId) update(State("error", adError.toMap())) }
          }
        })
      } catch (error: Exception) {
        fail(error.message ?: "Could not load swipeable interstitial ad.")
      }
    }
  }

  fun markLoadFailed(message: String) {
    main.post {
      if (released) return@post
      loadId++
      tearDown()
      fail(message)
    }
  }

  private fun fail(message: String) = update(State("error", mapOf(
    "code" to -1, "message" to message, "domain" to "ExpoGoogleMobileAds"
  )))

  private fun update(next: State) {
    state = next
    emit("statusChange", mapOf("status" to next.status, "error" to next.error))
  }

  // Called only from the view, so an Activity is never required for preload.
  fun getView(activity: Activity): View? {
    if (released) return null
    return view ?: ad?.getView(activity)?.also { view = it }
  }

  fun detachView(owner: SwipeableInterstitialAdView) {
    view?.takeIf { it.parent === owner }?.let { owner.removeView(it) }
  }

  private fun tearDown() {
    view?.let { (it.parent as? ViewGroup)?.removeView(it) }
    view = null
    ad?.adEventCallback = null
    ad?.destroy()
    ad = null
  }

  override fun sharedObjectDidRelease() {
    main.post {
      released = true
      loadId++
      tearDown()
      attachment = null
    }
  }
}
