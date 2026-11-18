package expo.modules.googlemobileads

import android.app.Activity
import com.google.android.libraries.ads.mobile.sdk.common.AdLoadCallback
import com.google.android.libraries.ads.mobile.sdk.common.AdRequest
import com.google.android.libraries.ads.mobile.sdk.common.AdValue
import com.google.android.libraries.ads.mobile.sdk.common.FullScreenContentError
import com.google.android.libraries.ads.mobile.sdk.common.LoadAdError
import com.google.android.libraries.ads.mobile.sdk.rewarded.OnUserEarnedRewardListener
import com.google.android.libraries.ads.mobile.sdk.rewarded.RewardItem
import com.google.android.libraries.ads.mobile.sdk.rewardedinterstitial.RewardedInterstitialAdEventCallback
import expo.modules.kotlin.AppContext
import java.util.concurrent.atomic.AtomicReference
import com.google.android.libraries.ads.mobile.sdk.rewardedinterstitial.RewardedInterstitialAd as GmaRewardedInterstitialAd

class RewardedInterstitialAd(
  appContext: AppContext,
  adUnitId: String,
  requestOptions: Map<String, Any?>?
) : FullScreenAd(appContext, adUnitId, requestOptions) {

  @Volatile
  private var ad: GmaRewardedInterstitialAd? = null

  @Volatile
  var reward: Map<String, Any?>? = null
    private set

  private val earnedReward = AtomicReference<Map<String, Any?>?>(null)

  override fun loadAd(request: AdRequest, loadId: Long) {
    GmaRewardedInterstitialAd.load(
      request,
      object : AdLoadCallback<GmaRewardedInterstitialAd> {
        override fun onAdLoaded(ad: GmaRewardedInterstitialAd) {
          postToMain { onAdReady(ad, loadId) }
        }

        override fun onAdFailedToLoad(adError: LoadAdError) {
          postToMain { handleLoadFailed(adError, loadId) }
        }
      }
    )
  }

  private fun onAdReady(loaded: GmaRewardedInterstitialAd, loadId: Long) {
    if (isStaleLoadResult(loadId) || shouldDiscardLoadResult) {
      loaded.destroy()
      return
    }
    tearDownAd()
    loaded.adEventCallback = object : RewardedInterstitialAdEventCallback {
      override fun onAdShowedFullScreenContent() = handleShowed()

      override fun onAdDismissedFullScreenContent() = handleDismissed()

      override fun onAdFailedToShowFullScreenContent(fullScreenContentError: FullScreenContentError) =
        handleFailedToShow(fullScreenContentError)

      override fun onAdImpression() = handleImpression()

      override fun onAdClicked() = handleClicked()

      override fun onAdPaid(value: AdValue) = handlePaid(value)

    }
    ad = loaded
    reward = loaded.getRewardItem().toMap()
    handleLoaded(loaded.getResponseInfo())
  }

  override fun presentAd(activity: Activity): Boolean {
    val current = ad ?: return false
    current.show(
      activity,
      object : OnUserEarnedRewardListener {
        override fun onUserEarnedReward(rewardItem: RewardItem) {
          val earned = rewardItem.toMap()
          earnedReward.set(earned)
          emit("earnedReward", earned)
        }
      }
    )
    return true
  }

  override fun showResult(): Map<String, Any?>? = earnedReward.get()

  override fun tearDownAd() {
    ad?.let {
      it.adEventCallback = null
      it.destroy()
    }
    ad = null
    earnedReward.set(null)
    reward = null
  }
}

private fun RewardItem.toMap(): Map<String, Any?> = mapOf(
  "type" to type,
  "amount" to amount
)
