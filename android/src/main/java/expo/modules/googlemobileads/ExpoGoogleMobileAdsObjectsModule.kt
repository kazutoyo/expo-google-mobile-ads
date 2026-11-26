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
  // Constructors run on JS; resume runs on the activity thread. Keep only weak keys so the
  // module never extends an ad's lifetime, and copy under the lock before dispatching work.
  private val appOpenAds = java.util.WeakHashMap<AppOpenAd, Unit>()
  override fun definition() = ModuleDefinition {
    Name("ExpoGoogleMobileAdsObjects")

    OnActivityEntersForeground {
      val ads = synchronized(appOpenAds) { appOpenAds.keys.toList() }
      ads.forEach { it.revalidateExpiration() }
    }

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

    Class(AppOpenAd::class) {
      Constructor { adUnitId: String, requestOptions: Map<String, Any?>? ->
        AppOpenAd(appContext, adUnitId, requestOptions).also { ad ->
          synchronized(appOpenAds) { appOpenAds[ad] = Unit }
        }
      }

      Property("status") { ad: AppOpenAd -> ad.appOpenStatus }
      Property("error") { ad: AppOpenAd -> ad.error }
      Property("responseInfo") { ad: AppOpenAd -> ad.responseInfo }

      Function("load") { ad: AppOpenAd -> ad.load() }
      Function("markLoadFailed") { ad: AppOpenAd, message: String -> ad.markLoadFailed(message) }
      AsyncFunction("showAsync") { ad: AppOpenAd, promise: Promise -> ad.showAsync(promise) }

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

    Class(SwipeableInterstitialAd::class) {
      Constructor { adUnitId: String, size: Map<String, Double>?, maxScreenHoldDuration: Int,
                    requestOptions: Map<String, Any?>? ->
        SwipeableInterstitialAd(appContext, adUnitId, size, maxScreenHoldDuration, requestOptions)
      }
      Property("status") { ad: SwipeableInterstitialAd -> ad.status }
      Property("error") { ad: SwipeableInterstitialAd -> ad.error }
      Property("responseInfo") { ad: SwipeableInterstitialAd -> ad.responseInfo }
      Property("minScreenHoldDuration") { ad: SwipeableInterstitialAd -> ad.minScreenHoldDuration }
      Function("load") { ad: SwipeableInterstitialAd -> ad.load() }
      Function("markLoadFailed") { ad: SwipeableInterstitialAd, message: String -> ad.markLoadFailed(message) }
      Events("statusChange", "impression", "clicked", "paid", "screenPresented", "screenDismissed", "screenHoldTimerStarted")
    }

    View(SwipeableInterstitialAdView::class) {
      Prop("ad") { view: SwipeableInterstitialAdView, ad: SwipeableInterstitialAd? -> view.setAd(ad) }
      OnViewDestroys { view: SwipeableInterstitialAdView -> view.onDestroy() }
    }

    Class(RewardedInterstitialAd::class) {
      Constructor { adUnitId: String, requestOptions: Map<String, Any?>? ->
        RewardedInterstitialAd(appContext, adUnitId, requestOptions)
      }

      Property("status") { ad: RewardedInterstitialAd -> ad.status }
      Property("error") { ad: RewardedInterstitialAd -> ad.error }
      Property("responseInfo") { ad: RewardedInterstitialAd -> ad.responseInfo }
      Property("reward") { ad: RewardedInterstitialAd -> ad.reward }

      Function("load") { ad: RewardedInterstitialAd -> ad.load() }
      Function("markLoadFailed") { ad: RewardedInterstitialAd, message: String -> ad.markLoadFailed(message) }
      AsyncFunction("showAsync") { ad: RewardedInterstitialAd, promise: Promise -> ad.showAsync(promise) }

      Events("statusChange", "showed", "dismissed", "impression", "clicked", "paid", "earnedReward")
    }

    Class(NativeAd::class) {
      Constructor { adUnitId: String, requestOptions: Map<String, Any?>? -> NativeAd(appContext, adUnitId, requestOptions) }
      Property("status") { ad: NativeAd -> ad.status }
      Property("error") { ad: NativeAd -> ad.error }
      Property("responseInfo") { ad: NativeAd -> ad.responseInfo }
      Property("assets") { ad: NativeAd -> ad.assets }
      Function("load") { ad: NativeAd -> ad.load() }
      Function("markLoadFailed") { ad: NativeAd, message: String -> ad.markLoadFailed(message) }
      Events("statusChange", "impression", "clicked", "paid")
    }
    View(NativeAdCardView::class) {
      Name("NativeAdView")
      Prop("ad") { view: NativeAdCardView, ad: NativeAd? -> view.setAd(ad) }
      Prop("layout") { view: NativeAdCardView, layout: String? ->
        view.setLayout(NativeAdLayout.entries.find { it.value == layout } ?: NativeAdLayout.CARD)
      }
      Prop("bottomInset") { view: NativeAdCardView, bottomInset: Double? -> view.setBottomInset(bottomInset ?: 0.0) }
      OnViewDestroys { view: NativeAdCardView -> view.onDestroy() }
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
