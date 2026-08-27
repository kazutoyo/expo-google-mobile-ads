package expo.modules.googlemobileads

import android.app.Activity
import com.google.android.libraries.ads.mobile.sdk.common.AdLoadCallback
import com.google.android.libraries.ads.mobile.sdk.common.AdRequest
import com.google.android.libraries.ads.mobile.sdk.common.AdValue
import com.google.android.libraries.ads.mobile.sdk.common.FullScreenContentError
import com.google.android.libraries.ads.mobile.sdk.common.LoadAdError
import com.google.android.libraries.ads.mobile.sdk.interstitial.InterstitialAdEventCallback
import expo.modules.kotlin.AppContext
import com.google.android.libraries.ads.mobile.sdk.interstitial.InterstitialAd as GmaInterstitialAd

/**
 * The interstitial format. Registered with JS as `InterstitialAd`.
 *
 * The GMA type of the same name is imported as `GmaInterstitialAd`, the same aliasing `BannerAd`
 * already uses for `BannerAd`. (iOS could not do this — ObjC's `NS_SWIFT_NAME(InterstitialAd)` is
 * not aliasable — which is why the Swift class there is `FullScreenInterstitialAd` with an explicit
 * JS-facing name.)
 */
class InterstitialAd(
  appContext: AppContext,
  adUnitId: String,
  requestOptions: Map<String, Any?>?
) : FullScreenAd(appContext, adUnitId, requestOptions) {

  /**
   * The loaded ad. `@Volatile` because it is written on the main thread but `tearDownAd()` and
   * `presentAd()` are reached from posts that may observe a write made by a different thread's
   * post; cheap insurance either way.
   */
  @Volatile
  private var ad: GmaInterstitialAd? = null

  override fun loadAd(request: AdRequest) {
    // Static load on the companion; there is no `InterstitialAdRequest` — this takes the common
    // `AdRequest`, unlike the banner's `BannerAdRequest`.
    GmaInterstitialAd.load(
      request,
      object : AdLoadCallback<GmaInterstitialAd> {
        // Both methods are `default` in the AAR, so a missing override would compile into a
        // silent no-op. Both are implemented deliberately.
        override fun onAdLoaded(ad: GmaInterstitialAd) {
          // The SDK does not document which thread this arrives on; hopped to main so it is
          // ordered against `load()`, `showAsync()` and the teardown post, all of which run there.
          postToMain { onAdReady(ad) }
        }

        override fun onAdFailedToLoad(adError: LoadAdError) {
          postToMain { handleLoadFailed(adError) }
        }
      }
    )
  }

  /** Main thread. */
  private fun onAdReady(loaded: GmaInterstitialAd) {
    if (isReleased) {
      // Released while the request was in flight. Destroy the ad instead of wiring it up —
      // `tearDownAd()` has already run and will not run again.
      loaded.destroy()
      return
    }
    loaded.adEventCallback = object : InterstitialAdEventCallback {
      override fun onAdShowedFullScreenContent() = handleShowed()

      override fun onAdDismissedFullScreenContent() = handleDismissed()

      override fun onAdFailedToShowFullScreenContent(fullScreenContentError: FullScreenContentError) =
        handleFailedToShow(fullScreenContentError)

      override fun onAdImpression() = handleImpression()

      override fun onAdClicked() = handleClicked()

      override fun onAdPaid(value: AdValue) = handlePaid(value)

      // onAppEvent is left at its default no-op: it only fires for Ad Manager ad types and has
      // no JS-side event.
    }
    ad = loaded
    // `getResponseInfo()` / `getRewardItem()` are declared as *functions* in the AAR's Kotlin
    // metadata, not properties, so they do not synthesize `ad.responseInfo` — the same reason
    // `BannerAd` calls `ad.getResponseInfo()`. (`adEventCallback` really is a property.)
    handleLoaded(loaded.getResponseInfo())
  }

  override fun presentAd(activity: Activity): Boolean {
    val current = ad ?: return false
    // Returns void and never throws: a failed presentation is reported asynchronously through
    // `onAdFailedToShowFullScreenContent`.
    current.show(activity)
    return true
  }

  override fun tearDownAd() {
    ad?.let {
      it.adEventCallback = null
      it.destroy()
    }
    ad = null
  }
}
