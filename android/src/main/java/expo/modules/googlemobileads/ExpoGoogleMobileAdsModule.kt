package expo.modules.googlemobileads

import android.app.Activity
import android.content.Context
import android.os.Handler
import android.os.Looper
import com.google.android.libraries.ads.mobile.sdk.MobileAds
import com.google.android.libraries.ads.mobile.sdk.banner.AdSize
import com.google.android.libraries.ads.mobile.sdk.common.RequestConfiguration
import com.google.android.libraries.ads.mobile.sdk.initialization.AdapterStatus
import com.google.android.libraries.ads.mobile.sdk.initialization.InitializationConfig
import com.google.android.ump.FormError
import com.google.android.ump.UserMessagingPlatform
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.CountDownLatch
import kotlin.coroutines.resume
import kotlin.math.roundToInt
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext

private val mainHandler = Handler(Looper.getMainLooper())

/**
 * Runs synchronously on the main thread if already there; otherwise hops to the main thread
 * synchronously before running (the Android counterpart of iOS's `runOnMain`
 * (`DispatchQueue.main.sync`)).
 *
 * [Android counterpart of Lesson 1] The `AdSize` adaptive-size calculation functions
 * (`getAnchoredAdaptiveSize`, etc.) are deliberately synchronous in the JS API (by design, so
 * the caller can finalize layout before the ad loads), so they can't be made async. GMA
 * Android's docs aren't as explicit as iOS's `GADAdSize.h` about main-thread-only, but these
 * read screen size/orientation, and reading UI-related state off the UI thread goes against
 * general Android convention, so this errs on the side of caution and explicitly hops to main.
 *
 * [Review fix round 3 — item 1, timeout removed]
 * The timeout added in fix round 2 (throwing `UiThreadUnresponsiveException` on no response)
 * was removed on the coordinator's instruction. Reason: `useBannerAdSize` calls this from a
 * render-time `useMemo`, so falling back would change `useBannerAd`'s
 * `useReleasingSharedObject` dependency array `[adUnitId, size.width, size.height]`, releasing
 * a preloaded ad and recreating one with the wrong size — and it would never fix itself unless
 * a rotation or resize happened. "The UI thread is stuck for 5 seconds" is already an ANR the
 * platform itself detects and reports with a trace; turning that into "the ad size is
 * permanently wrong" with no error at all is a regression, not an improvement. Instead of
 * throwing an exception, this now waits indefinitely, matching iOS's `runOnMain`
 * (`DispatchQueue.main.sync`). The `try/finally` that guarantees `countDown()` runs, and
 * re-throwing the caught exception on the JS-thread side (a real deadlock bug fixed in fix
 * round 1 — a case where an exception prevented `countDown()` from being reached), are kept
 * as-is.
 */
private fun <T> runOnMain(block: () -> T): T {
  if (Looper.myLooper() == Looper.getMainLooper()) {
    return block()
  }
  val latch = CountDownLatch(1)
  var result: T? = null
  var error: Throwable? = null
  mainHandler.post {
    try {
      result = block()
    } catch (t: Throwable) {
      error = t
    } finally {
      latch.countDown()
    }
  }
  latch.await()
  error?.let { throw it }
  @Suppress("UNCHECKED_CAST")
  return result as T
}

private fun Map<String, Any?>.toRequestConfiguration(): RequestConfiguration {
  val builder = RequestConfiguration.Builder()

  (this["testDeviceIds"] as? List<*>)?.let { ids ->
    builder.setTestDeviceIds(ids.filterIsInstance<String>())
  }
  (this["tagForChildDirectedTreatment"] as? Boolean)?.let { childDirected ->
    builder.setTagForChildDirectedTreatment(
      if (childDirected) {
        RequestConfiguration.TagForChildDirectedTreatment.TAG_FOR_CHILD_DIRECTED_TREATMENT_TRUE
      } else {
        RequestConfiguration.TagForChildDirectedTreatment.TAG_FOR_CHILD_DIRECTED_TREATMENT_FALSE
      }
    )
  }
  (this["tagForUnderAgeOfConsent"] as? Boolean)?.let { underAge ->
    builder.setTagForUnderAgeOfConsent(
      if (underAge) {
        RequestConfiguration.TagForUnderAgeOfConsent.TAG_FOR_UNDER_AGE_OF_CONSENT_TRUE
      } else {
        RequestConfiguration.TagForUnderAgeOfConsent.TAG_FOR_UNDER_AGE_OF_CONSENT_FALSE
      }
    )
  }
  (this["maxAdContentRating"] as? String)?.let { rating ->
    val maxAdContentRating = when (rating) {
      "G" -> RequestConfiguration.MaxAdContentRating.MAX_AD_CONTENT_RATING_G
      "PG" -> RequestConfiguration.MaxAdContentRating.MAX_AD_CONTENT_RATING_PG
      "T" -> RequestConfiguration.MaxAdContentRating.MAX_AD_CONTENT_RATING_T
      "MA" -> RequestConfiguration.MaxAdContentRating.MAX_AD_CONTENT_RATING_MA
      else -> RequestConfiguration.MaxAdContentRating.MAX_AD_CONTENT_RATING_UNSPECIFIED
    }
    builder.setMaxAdContentRating(maxAdContentRating)
  }

  return builder.build()
}

private fun AdSize.toMap(): Map<String, Any?> = mapOf("width" to width, "height" to height)

/**
 * Rejects [promise] with the normalized code, or resolves it with a fresh snapshot.
 *
 * Every UMP callback on Android hands back a nullable [FormError], so this is the single place
 * that turns one into a JS rejection — the six functions below never build a rejection themselves.
 *
 * This is always called from inside a UMP listener callback, and the module's invariant is
 * "every UMP call on the main thread" — including the [consentSnapshot] read below, which touches
 * four `ConsentInformation` properties. That invariant holds here because the UMP SDK itself
 * dispatches these callbacks to the main thread, not because this function enforces it, so there
 * is no `mainHandler.post` hop: it is already on main and re-posting would only add latency.
 */
private fun settleConsent(promise: Promise, context: Context, error: FormError?) {
  if (error != null) {
    promise.reject(consentErrorCode(error.errorCode), consentErrorMessage(error), null)
    return
  }
  promise.resolve(consentSnapshot(context))
}

class ExpoGoogleMobileAdsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoGoogleMobileAds")

    AsyncFunction("initializeAsync") Coroutine { ->
      // [Android counterpart of Lesson 1 — the reverse case] `MobileAds.initialize()` involves
      // heavy work including network-bound adapter initialization, and calling it on the main
      // thread risks an ANR. Unlike iOS's `MobileAds.shared.start()`, which explicitly moves to
      // main (since it's lightweight there), Android explicitly offloads this to a background
      // (IO) thread instead.
      withContext(Dispatchers.IO) {
        val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
        val appId = AppIdProvider.get(context)
        suspendCancellableCoroutine { continuation ->
          MobileAds.initialize(
            context,
            InitializationConfig.Builder(appId).build()
          ) { status ->
            val adapterStatuses = status.adapterStatusMap.mapValues { (_, adapterStatus) ->
              mapOf(
                // The real `AdapterStatus.InitializationState` only has NOT_STARTED /
                // INITIALIZING / COMPLETE / TIMED_OUT / FAILED — the brief's assumed READY
                // value doesn't exist. COMPLETE is the only one that maps to "ready".
                "state" to if (adapterStatus.initializationState ==
                  AdapterStatus.InitializationState.COMPLETE
                ) {
                  "ready"
                } else {
                  "notReady"
                },
                "description" to adapterStatus.description,
                // AdapterStatus.getLatency() is already exposed as an Int in milliseconds on
                // Android, so unlike iOS no *1000 conversion is needed.
                "latency" to adapterStatus.latency
              )
            }
            continuation.resume(mapOf("adapterStatuses" to adapterStatuses))
          }
        }
      }
    }

    // [Review fix — I2] This used to post to main, but since `initializeAsync` calls
    // `MobileAds.initialize()` on `Dispatchers.IO` (a different thread), there's no ordering
    // guarantee between "posting to main" and "dispatching to IO" — two unrelated queues — so
    // even if JS called `setRequestConfiguration()` then `initialize()` in that order, there
    // was a race where `testDeviceIds` could end up applied after initialization (iOS's
    // premise — "calls run FIFO on the same main queue" — doesn't hold for this Android
    // setup). This function has no documented main-thread-only constraint and is just a plain
    // static setter, so there's no point offloading it to a different queue either. Calling it
    // synchronously on the JS thread guarantees that the order JS called it in is the order it
    // executes in.
    Function("setRequestConfiguration") { config: Map<String, Any?> ->
      MobileAds.setRequestConfiguration(config.toRequestConfiguration())
    }

    // [Review fix — M1] This used to require `appContext.currentActivity` and throw
    // `Exceptions.MissingActivity()` if absent. But the same JS-side function is contracted to
    // never fail on iOS, and having the same JS call throw or not depending on platform breaks
    // that contract. In fact, none of these `AdSize` static functions require an `Activity` —
    // just a generic `Context` (confirmed via javap) — so the correct fix is to use
    // `appContext.reactContext` instead of `appContext.currentActivity`. `reactContext` is
    // effectively guaranteed to exist by the time JS can call this function at all (i.e. once a
    // React instance exists), which effectively matches iOS's "never fails" contract.
    //
    // Both anchored functions go through `makeAdaptiveAdSize`, the same function `BannerAd`
    // rebuilds a size with once it has crossed the JS boundary — the size a caller lays out
    // against and the size actually requested therefore come from the same factory call.
    Function("getAnchoredAdaptiveSize") { width: Double, orientation: String ->
      runOnMain {
        val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
        val kind = when (orientation) {
          "portrait" -> BannerAdSizeKind.ANCHORED_PORTRAIT
          "landscape" -> BannerAdSizeKind.ANCHORED_LANDSCAPE
          else -> BannerAdSizeKind.ANCHORED
        }
        makeAdaptiveAdSize(context, kind, width.roundToInt(), 0).toMap()
      }
    }

    Function("getLargeAnchoredAdaptiveSize") { width: Double, orientation: String ->
      runOnMain {
        val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
        val kind = when (orientation) {
          "portrait" -> BannerAdSizeKind.LARGE_ANCHORED_PORTRAIT
          "landscape" -> BannerAdSizeKind.LARGE_ANCHORED_LANDSCAPE
          else -> BannerAdSizeKind.LARGE_ANCHORED
        }
        makeAdaptiveAdSize(context, kind, width.roundToInt(), 0).toMap()
      }
    }

    // Only the max-height form is exposed. The per-orientation helpers are, per the AAR's own
    // bytecode, nothing but `getInlineAdaptiveBannerAdSize(width, <device height in dp>)` — a
    // ~923dp max height on a Pixel 9a, which is not a height a caller can reserve space for.
    // iOS cannot express that form as `{width, height}` at all. See `inlineAdaptive()` in
    // BannerAdSize.ts.
    //
    // `getInlineAdaptiveBannerAdSize(width, maxHeight)` is a static calculation needing no
    // Context, and no longer reads any UI state, so it does not need `runOnMain` either.
    Function("getInlineAdaptiveSize") { width: Double, maxHeight: Double ->
      AdSize.getInlineAdaptiveBannerAdSize(width.roundToInt(), maxHeight.roundToInt()).toMap()
    }

    // MARK: - UMP consent
    //
    // Every one of these resolves an Activity at call time and never caches it: at preload there
    // may be none at all. When there is none the call rejects with `noActivity` rather than
    // failing silently — the same trap phase 1 hit with `BannerAd.load()`.
    //
    // All of them run on `Dispatchers.Main`: UMP's consent calls are main-thread-only on Android
    // as well, and `Coroutine` would otherwise run them on a background dispatcher.

    AsyncFunction("gatherConsentAsync") { options: Map<String, Any?>?, promise: Promise ->
      withMainConsentActivity(promise) { activity ->
        val info = consentInformation(activity)
        info.requestConsentInfoUpdate(
          activity,
          makeConsentRequestParameters(activity, options),
          {
            // Composed here rather than in JS so nothing can interleave between the update and
            // the form, and so the Activity is resolved once instead of twice.
            UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity) { formError ->
              settleConsent(promise, activity, formError)
            }
          },
          { requestError -> settleConsent(promise, activity, requestError) }
        )
      }
    }

    AsyncFunction("requestConsentInfoUpdateAsync") { options: Map<String, Any?>?, promise: Promise ->
      withMainConsentActivity(promise) { activity ->
        consentInformation(activity).requestConsentInfoUpdate(
          activity,
          makeConsentRequestParameters(activity, options),
          { settleConsent(promise, activity, null) },
          { requestError -> settleConsent(promise, activity, requestError) }
        )
      }
    }

    AsyncFunction("showConsentFormIfRequiredAsync") { promise: Promise ->
      withMainConsentActivity(promise) { activity ->
        UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity) { formError ->
          settleConsent(promise, activity, formError)
        }
      }
    }

    AsyncFunction("showPrivacyOptionsFormAsync") { promise: Promise ->
      withMainConsentActivity(promise) { activity ->
        UserMessagingPlatform.showPrivacyOptionsForm(activity) { formError ->
          settleConsent(promise, activity, formError)
        }
      }
    }

    // Reading consent state needs only a Context, not an Activity, so this one never produces
    // `noActivity`. It stays async because iOS's equivalent is main-thread-only.
    AsyncFunction("getConsentInfoAsync") { promise: Promise ->
      withMainConsentContext(promise) { context ->
        promise.resolve(consentSnapshot(context))
      }
    }

    AsyncFunction("resetConsentAsync") { promise: Promise ->
      withMainConsentContext(promise) { context ->
        consentInformation(context).reset()
        promise.resolve(consentSnapshot(context))
      }
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

  /**
   * Resolves the current Activity on the main thread and runs [block] with it, rejecting
   * [promise] with `noActivity` if there is none.
   *
   * Resolved on every call, never cached: a consent call can arrive at app startup before any
   * Activity exists, which is the same condition phase 1 hit when a banner was preloaded.
   */
  private fun withMainConsentActivity(promise: Promise, block: (Activity) -> Unit) {
    mainHandler.post {
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.reject(
          "noActivity",
          "No Activity is in the foreground, so the consent SDK cannot be called. " +
            "Call this once the app has a screen on display.",
          null
        )
        return@post
      }
      block(activity)
    }
  }

  /**
   * Resolves the React context and runs [block] with it on the main thread, rejecting [promise]
   * with `internal` if the context is already gone.
   *
   * Unlike [withMainConsentActivity], a missing [Context] is not a normal "not ready yet" state
   * (a `Context` outlives any single `Activity`), so it is checked before hopping to main rather
   * than inside the posted block — no point scheduling work for a promise already dead.
   */
  private fun withMainConsentContext(promise: Promise, block: (Context) -> Unit) {
    val context = appContext.reactContext
    if (context == null) {
      promise.reject("internal", "The React context is gone.", null)
      return
    }
    mainHandler.post { block(context) }
  }
}
