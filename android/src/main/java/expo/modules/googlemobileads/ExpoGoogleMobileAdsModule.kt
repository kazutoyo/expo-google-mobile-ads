package expo.modules.googlemobileads

import android.app.Activity
import android.os.Handler
import android.os.Looper
import com.google.android.libraries.ads.mobile.sdk.MobileAds
import com.google.android.libraries.ads.mobile.sdk.banner.AdSize
import com.google.android.libraries.ads.mobile.sdk.common.RequestConfiguration
import com.google.android.libraries.ads.mobile.sdk.initialization.AdapterStatus
import com.google.android.libraries.ads.mobile.sdk.initialization.InitializationConfig
import com.google.android.ump.FormError
import com.google.android.ump.UserMessagingPlatform
import io.github.expo.modules.v2.ExpoModule
import io.github.expo.modules.v2.JS
import io.github.expo.modules.v2.JavaScriptThrowable
import io.github.expo.modules.v2.Module
import io.github.expo.modules.v2.react.currentActivity
import io.github.expo.modules.v2.react.androidContextOrNull
import java.util.concurrent.CountDownLatch
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
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
 * A UMP failure, or a missing Activity or context, as JS sees it: `code` is the normalized
 * `ConsentErrorCode` string.
 */
private class ConsentException(override val code: String, message: String) :
  JavaScriptThrowable(message)

private fun FormError.toException() =
  ConsentException(consentErrorCode(errorCode), consentErrorMessage(this))

/**
 * The module-level functions, on the Expo Modules API 2.0.
 *
 * The ad objects and the banner view live in [ExpoGoogleMobileAdsObjectsModule] instead: a 2.0
 * module runs on a separate runtime and cannot hold any of the 1.0 DSL.
 */
@ExpoModule("ExpoGoogleMobileAds")
class ExpoGoogleMobileAdsModule : Module() {
  @JS
  suspend fun initializeAsync(): Map<String, Any?> {
    // [Android counterpart of Lesson 1 — the reverse case] `MobileAds.initialize()` involves
    // heavy work including network-bound adapter initialization, and calling it on the main
    // thread risks an ANR. Unlike iOS's `MobileAds.shared.start()`, which explicitly moves to
    // main (since it's lightweight there), Android explicitly offloads this to a background
    // (IO) thread instead.
    val context = androidContextOrNull ?: throw contextLost()
    return withContext(Dispatchers.IO) {
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
  @JS
  fun setRequestConfiguration(config: Map<String, Any?>) {
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
  @JS
  fun getAnchoredAdaptiveSize(width: Double, orientation: String): Map<String, Any?> =
    runOnMain {
      val context = androidContextOrNull ?: throw contextLost()
      val kind = when (orientation) {
        "portrait" -> BannerAdSizeKind.ANCHORED_PORTRAIT
        "landscape" -> BannerAdSizeKind.ANCHORED_LANDSCAPE
        else -> BannerAdSizeKind.ANCHORED
      }
      makeAdaptiveAdSize(context, kind, width.roundToInt(), 0).toMap()
    }

  @JS
  fun getLargeAnchoredAdaptiveSize(width: Double, orientation: String): Map<String, Any?> =
    runOnMain {
      val context = androidContextOrNull ?: throw contextLost()
      val kind = when (orientation) {
        "portrait" -> BannerAdSizeKind.LARGE_ANCHORED_PORTRAIT
        "landscape" -> BannerAdSizeKind.LARGE_ANCHORED_LANDSCAPE
        else -> BannerAdSizeKind.LARGE_ANCHORED
      }
      makeAdaptiveAdSize(context, kind, width.roundToInt(), 0).toMap()
    }

  // Only the max-height form is exposed. The per-orientation helpers are, per the AAR's own
  // bytecode, nothing but `getInlineAdaptiveBannerAdSize(width, <device height in dp>)` — a
  // ~923dp max height on a Pixel 9a, which is not a height a caller can reserve space for.
  // iOS cannot express that form as `{width, height}` at all. See `inlineAdaptive()` in
  // BannerAdSize.ts.
  //
  // `getInlineAdaptiveBannerAdSize(width, maxHeight)` is a static calculation needing no
  // Context, and no longer reads any UI state, so it does not need `runOnMain` either.
  @JS
  fun getInlineAdaptiveSize(width: Double, maxHeight: Double): Map<String, Any?> =
    AdSize.getInlineAdaptiveBannerAdSize(width.roundToInt(), maxHeight.roundToInt()).toMap()

  // MARK: - UMP consent
  //
  // Every one of these resolves an Activity at call time and never caches it: at preload there
  // may be none at all. When there is none the call rejects with `noActivity` rather than
  // failing silently — the same trap phase 1 hit with `BannerAd.load()`.
  //
  // All of them run on `Dispatchers.Main`: UMP's consent calls are main-thread-only on Android.
  // The UMP SDK calls its listeners on the main thread too, so the snapshot read after each
  // callback stays on main.

  @JS
  suspend fun gatherConsentAsync(options: Map<String, Any?>?): Map<String, Any?> =
    withConsentActivity { activity ->
      // Composed here rather than in JS so nothing can interleave between the update and the
      // form, and so the Activity is resolved once instead of twice.
      requestInfoUpdate(activity, options)
      awaitFormError { UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity, it) }
    }

  @JS
  suspend fun requestConsentInfoUpdateAsync(options: Map<String, Any?>?): Map<String, Any?> =
    withConsentActivity { activity -> requestInfoUpdate(activity, options) }

  @JS
  suspend fun showConsentFormIfRequiredAsync(): Map<String, Any?> =
    withConsentActivity { activity ->
      awaitFormError { UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity, it) }
    }

  @JS
  suspend fun showPrivacyOptionsFormAsync(): Map<String, Any?> =
    withConsentActivity { activity ->
      awaitFormError { UserMessagingPlatform.showPrivacyOptionsForm(activity, it) }
    }

  // Reading consent state needs only a Context, not an Activity, so this one never produces
  // `noActivity`. It stays async because iOS's equivalent is main-thread-only.
  @JS
  suspend fun getConsentInfoAsync(): Map<String, Any?> {
    val context = androidContextOrNull ?: throw contextLost()
    return withContext(Dispatchers.Main) { consentSnapshot(context) }
  }

  @JS
  suspend fun resetConsentAsync(): Map<String, Any?> {
    val context = androidContextOrNull ?: throw contextLost()
    return withContext(Dispatchers.Main) {
      consentInformation(context).reset()
      consentSnapshot(context)
    }
  }

  /**
   * Resolves the current Activity on the main thread, runs [block] with it and returns the
   * consent snapshot. Throws `noActivity` if there is none.
   *
   * Resolved on every call, never cached: a consent call can arrive at app startup before any
   * Activity exists, which is the same condition phase 1 hit when a banner was preloaded.
   */
  private suspend fun withConsentActivity(
    block: suspend (Activity) -> Unit
  ): Map<String, Any?> = withContext(Dispatchers.Main) {
    // `currentActivity` is a Java getter, so it can be null despite its platform type.
    val activity: Activity = (currentActivity as Activity?) ?: throw ConsentException(
      "noActivity",
      "No Activity is in the foreground, so the consent SDK cannot be called. " +
        "Call this once the app has a screen on display."
    )
    block(activity)
    consentSnapshot(activity)
  }

  private suspend fun requestInfoUpdate(activity: Activity, options: Map<String, Any?>?) =
    suspendCancellableCoroutine { continuation ->
      consentInformation(activity).requestConsentInfoUpdate(
        activity,
        makeConsentRequestParameters(activity, options),
        { continuation.resume(Unit) },
        { error -> continuation.resumeWithException(error.toException()) }
      )
    }

  /** Runs a UMP call whose listener reports a nullable [FormError], and throws if it is set. */
  private suspend fun awaitFormError(call: ((FormError?) -> Unit) -> Unit) =
    suspendCancellableCoroutine { continuation ->
      call { error ->
        if (error != null) {
          continuation.resumeWithException(error.toException())
        } else {
          continuation.resume(Unit)
        }
      }
    }

  private fun contextLost() = ConsentException("internal", "The React context is gone.")
}
