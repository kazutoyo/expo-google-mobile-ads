package expo.modules.googlemobileads

import android.app.Activity
import com.google.android.libraries.ads.mobile.sdk.common.AdLoadCallback
import com.google.android.libraries.ads.mobile.sdk.common.AdRequest
import com.google.android.libraries.ads.mobile.sdk.common.AdValue
import com.google.android.libraries.ads.mobile.sdk.common.FullScreenContentError
import com.google.android.libraries.ads.mobile.sdk.common.LoadAdError
import com.google.android.libraries.ads.mobile.sdk.rewarded.OnUserEarnedRewardListener
import com.google.android.libraries.ads.mobile.sdk.rewarded.RewardItem
import com.google.android.libraries.ads.mobile.sdk.rewarded.RewardedAdEventCallback
import expo.modules.kotlin.AppContext
import java.util.concurrent.atomic.AtomicReference
import com.google.android.libraries.ads.mobile.sdk.rewarded.RewardedAd as GmaRewardedAd

/**
 * The rewarded format. Registered with JS as `RewardedAd`. The GMA type of the same name is
 * imported as `GmaRewardedAd`, as in [InterstitialAd].
 */
class RewardedAd(
  appContext: AppContext,
  adUnitId: String,
  requestOptions: Map<String, Any?>?
) : FullScreenAd(appContext, adUnitId, requestOptions) {

  @Volatile
  private var ad: GmaRewardedAd? = null

  /**
   * What this ad offers, snapshotted from `getRewardItem()` when it loads. Confirmed `@NotNull` in
   * the AAR and readable before the ad is shown, exactly like iOS's `adReward` — so, exactly like
   * on iOS, **its presence says nothing about whether the reward was earned.** It is here so a
   * prompt can say "watch an ad for 10 coins" before showing anything.
   */
  @Volatile
  var reward: Map<String, Any?>? = null
    private set

  /**
   * The reward the user actually earned, or null if [OnUserEarnedRewardListener] never fired.
   *
   * This is the Android half of the parity that matters most. Android hands the reward straight to
   * the listener as a `RewardItem` parameter, so "was a reward earned?" is simply "is this
   * non-null?". iOS reaches the identical observable result the hard way: its
   * `GADUserDidEarnRewardHandler` takes **no arguments**, so it has to latch a boolean and read the
   * pre-populated `adReward` at that moment. Both platforms therefore resolve `show()` with the
   * reward only when the handler fired, and with `null` for a user who dismissed without earning
   * one — which is a real-money distinction no compiler or unit test would catch.
   *
   * An `AtomicReference` for the same reason as the base's `showPromise`: written from an SDK
   * callback with no documented thread, read by [showResult] from the dismissal callback and by
   * nothing else.
   */
  private val earnedReward = AtomicReference<Map<String, Any?>?>(null)

  override fun loadAd(request: AdRequest) {
    GmaRewardedAd.load(
      request,
      object : AdLoadCallback<GmaRewardedAd> {
        override fun onAdLoaded(ad: GmaRewardedAd) {
          postToMain { onAdReady(ad) }
        }

        override fun onAdFailedToLoad(adError: LoadAdError) {
          postToMain { handleLoadFailed(adError) }
        }
      }
    )
  }

  /** Main thread. */
  private fun onAdReady(loaded: GmaRewardedAd) {
    if (isReleased) {
      loaded.destroy()
      return
    }
    loaded.adEventCallback = object : RewardedAdEventCallback {
      override fun onAdShowedFullScreenContent() = handleShowed()

      override fun onAdDismissedFullScreenContent() = handleDismissed()

      override fun onAdFailedToShowFullScreenContent(fullScreenContentError: FullScreenContentError) =
        handleFailedToShow(fullScreenContentError)

      override fun onAdImpression() = handleImpression()

      override fun onAdClicked() = handleClicked()

      override fun onAdPaid(value: AdValue) = handlePaid(value)

      // onAdMetadataChanged is left at its default no-op: ad metadata is not part of the JS API.
    }
    ad = loaded
    // Snapshot the offered reward now, so the JS-side `reward` getter never has to touch the ad.
    // Called as functions, not properties: the AAR's Kotlin metadata declares `getRewardItem()`
    // and `getResponseInfo()` as functions, so no `loaded.rewardItem` is synthesized.
    reward = loaded.getRewardItem().toMap()
    handleLoaded(loaded.getResponseInfo())
  }

  override fun presentAd(activity: Activity): Boolean {
    val current = ad ?: return false
    // Spelled out as an object expression rather than a lambda: `OnUserEarnedRewardListener` is a
    // Kotlin interface in the AAR, and SAM conversion from a Kotlin lambda only applies to Java
    // interfaces and to Kotlin `fun interface`s.
    current.show(
      activity,
      object : OnUserEarnedRewardListener {
        override fun onUserEarnedReward(rewardItem: RewardItem) {
          // Unlike iOS, the reward arrives as a parameter. Recorded before it is emitted, so a
          // listener that also reads `show()`'s eventual result cannot see the two disagree.
          val earned = rewardItem.toMap()
          earnedReward.set(earned)
          emit("earnedReward", earned)
        }
      }
    )
    return true
  }

  /** Resolves `showAsync()` with the reward **only if the listener actually fired**. */
  override fun showResult(): Map<String, Any?>? = earnedReward.get()

  override fun tearDownAd() {
    ad?.let {
      it.adEventCallback = null
      it.destroy()
    }
    ad = null
    // Also reached at the start of load(), so the per-presentation record is cleared here rather
    // than only at release. Android's reward path is the easy side — the reward is a listener
    // parameter, not a latched flag — but a stale `earnedReward` surviving into a second ad would
    // resolve show() with a reward nobody earned on this presentation. The `"shown"` guard in
    // FullScreenAd.load() already makes that unreachable; this is the cheap second layer.
    earnedReward.set(null)
    reward = null
  }
}

/**
 * `RewardItem.getAmount()` is an `Int` here and an `NSDecimalNumber` on iOS; the JS-side
 * `AdReward.amount` is a plain number, which both fit losslessly for real reward quantities.
 */
private fun RewardItem.toMap(): Map<String, Any?> = mapOf(
  "type" to type,
  "amount" to amount
)
