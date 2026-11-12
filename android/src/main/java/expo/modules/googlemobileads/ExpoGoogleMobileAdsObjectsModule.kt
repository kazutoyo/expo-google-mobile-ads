package expo.modules.googlemobileads

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * The ad objects and the banner view, still on the Expo Modules API 1.0 DSL.
 *
 * Kept apart from [ExpoGoogleMobileAdsModule] because a 2.0 module runs on a separate runtime
 * and cannot hold any 1.0 DSL. These stay on 1.0 because the 2.0 runtime has no views, and the
 * view's `ad` prop can only resolve a 1.0 shared object.
 */
class ExpoGoogleMobileAdsObjectsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoGoogleMobileAdsObjects")

    Class(BannerAd::class) {
      Constructor { adUnitId: String, size: Map<String, Any?>, requestOptions: Map<String, Any?>? ->
        val width = (size["width"] as? Number)?.toInt() ?: throw InvalidBannerSizeException()
        val height = (size["height"] as? Number)?.toInt() ?: throw InvalidBannerSizeException()
        // Only a kind the native side actually understands is kept, so `ad.size` can never
        // report a marker that would be ignored when the size is rebuilt. The `AdSize` itself is
        // built lazily on the main thread inside BannerAd.load() — see `BannerAd.adSize`.
        val adaptiveKind = BannerAdSizeKind.fromJsValue(size["adaptiveKind"] as? String)
        // [Android counterpart of Lesson 4] Deliberately doesn't resolve or require an
        // Activity here. The Constructor must succeed even during preload, when no Activity
        // exists yet. Activity resolution happens on every call to BannerAd.load()/ensureAdView().
        BannerAd(appContext, adUnitId, width, height, adaptiveKind, requestOptions)
      }

      Property("size") { ad: BannerAd -> ad.requestedSizeMap }
      Property("status") { ad: BannerAd -> ad.status }
      Property("error") { ad: BannerAd -> ad.error }
      Property("loadedSize") { ad: BannerAd -> ad.loadedSize }
      Property("responseInfo") { ad: BannerAd -> ad.responseInfo }

      Function("load") { ad: BannerAd -> ad.load() }
      // @internal, called only by the JS side's deferred-load helper when initialize() fails.
      Function("markLoadFailed") { ad: BannerAd, message: String -> ad.markLoadFailed(message) }

      Events("statusChange", "impression", "clicked", "paid")
    }

    // Full-screen ads have no view: they are constructed, load immediately, and are presented
    // later with showAsync(). Single-use — after presentation `status` is "shown" and stays there.
    // The `notLoaded` / `alreadyShown` guards live in JS (`assertShowable`) and are deliberately
    // not repeated here: Android has no readiness API at all, so module-side state is the only
    // thing that can make the two platforms agree.
    Class(InterstitialAd::class) {
      Constructor { adUnitId: String, requestOptions: Map<String, Any?>? ->
        // Deliberately resolves no Activity here — the Constructor must succeed during preload,
        // when there may be none. It is resolved on every showAsync() instead.
        InterstitialAd(appContext, adUnitId, requestOptions)
      }

      Property("status") { ad: InterstitialAd -> ad.status }
      Property("error") { ad: InterstitialAd -> ad.error }
      Property("responseInfo") { ad: InterstitialAd -> ad.responseInfo }

      Function("load") { ad: InterstitialAd -> ad.load() }
      // @internal, called only by the JS side's deferred-load helper when initialize() fails.
      Function("markLoadFailed") { ad: InterstitialAd, message: String -> ad.markLoadFailed(message) }
      AsyncFunction("showAsync") { ad: InterstitialAd, promise: Promise -> ad.showAsync(promise) }

      Events("statusChange", "showed", "dismissed", "impression", "clicked", "paid")
    }

    Class(RewardedAd::class) {
      Constructor { adUnitId: String, requestOptions: Map<String, Any?>? ->
        RewardedAd(appContext, adUnitId, requestOptions)
      }

      Property("status") { ad: RewardedAd -> ad.status }
      Property("error") { ad: RewardedAd -> ad.error }
      Property("responseInfo") { ad: RewardedAd -> ad.responseInfo }
      // What the ad offers, readable before it is shown. Not evidence that anything was earned —
      // only show()'s resolved value says that.
      Property("reward") { ad: RewardedAd -> ad.reward }

      Function("load") { ad: RewardedAd -> ad.load() }
      Function("markLoadFailed") { ad: RewardedAd, message: String -> ad.markLoadFailed(message) }
      AsyncFunction("showAsync") { ad: RewardedAd, promise: Promise -> ad.showAsync(promise) }

      Events("statusChange", "showed", "dismissed", "impression", "clicked", "paid", "earnedReward")
    }

    View(BannerAdView::class) {
      Prop("ad") { view: BannerAdView, ad: BannerAd? ->
        view.setAd(ad)
      }

      // [Review fix round 3 — item 3] `OnViewDestroys` is the real teardown hook, called from
      // `onDropViewInstance` only when React Native has decided it will really never use this
      // View instance again (unlike `onDetachedFromWindow`, it does not fire on
      // react-native-screens's temporary screen detaches). Calling `detachIfOwned()` here
      // actually removeViews the AdView (i.e. reliably nulls `View.mParent`), giving up
      // ownership at a deterministic time rather than leaving it to GC — replacing the
      // window-detach teardown that C3 correctly removed.
      OnViewDestroys { view: BannerAdView ->
        view.onDestroy()
      }
    }
  }
}
