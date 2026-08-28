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
    if (shouldDiscardLoadResult) {
      // Released, a show is in flight, or this ad has already been shown. Installing would mean
      // tearing down whatever is here — including, in the in-flight case, the callback the show
      // promise is waiting on.
      //
      // **Destroy the ad that just arrived, not the one that is here.** Tearing down the
      // presenting ad is exactly the hang iOS spent a round fixing. Unlike iOS, where ARC frees a
      // dropped ad on return, an Android ad holds native resources until `destroy()` is called —
      // so simply returning would leak it. Nothing has been wired up yet, so destroying it here is
      // complete cleanup.
      loaded.destroy()
      return
    }
    // Two loads can overlap: `load()` refuses to start a second request while a show is in flight,
    // but a request issued earlier can still land now. Clear and destroy whatever is here before
    // replacing it, or it keeps firing events into this shared object. Safe only because the guard
    // above has ruled out a presentation.
    tearDownAd()
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
