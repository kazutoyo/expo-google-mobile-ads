package expo.modules.googlemobileads

import android.app.Activity
import android.os.Handler
import android.os.Looper
import com.google.android.libraries.ads.mobile.sdk.common.AdRequest
import com.google.android.libraries.ads.mobile.sdk.common.AdValue
import com.google.android.libraries.ads.mobile.sdk.common.FullScreenContentError
import com.google.android.libraries.ads.mobile.sdk.common.LoadAdError
import com.google.android.libraries.ads.mobile.sdk.common.MediationAdError
import com.google.android.libraries.ads.mobile.sdk.common.ResponseInfo
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.Promise
import expo.modules.kotlin.sharedobjects.SharedObject
import java.util.concurrent.atomic.AtomicReference

private val mainHandler = Handler(Looper.getMainLooper())

/**
 * The `status`/`error`/`responseInfo` triple, bundled into one immutable snapshot behind a single
 * `@Volatile` reference — the same reasoning as `BannerAd`'s `LoadState`: marking each field
 * `@Volatile` would give per-field visibility but not consistency across the group read together.
 * (And the same caveat applies: JS reads `status` and `error` through two separate `Property`
 * calls, so a write landing between them can still be observed as a mismatched pair. iOS's
 * per-property `NSLock` has exactly the same limitation.)
 */
private data class FullScreenLoadState(
  val status: String,
  val error: Map<String, Any?>?,
  val responseInfo: Map<String, Any?>?
)

/**
 * Shared base for the two full-screen formats (interstitial and rewarded).
 *
 * A full-screen ad has no view: it is constructed, starts loading immediately, and is presented
 * later through `showAsync()`. Both SDKs treat these objects as **single-use** — Android answers a
 * second `show()` with `FullScreenContentError.ErrorCode.AD_REUSED` — so `"shown"` is a terminal
 * status and the caller is expected to build a new ad for the next impression. The JS side already
 * refuses to call `showAsync()` unless `status == "loaded"` (`assertShowable` in
 * `src/FullScreenAd.ts`), so the guards below are only a native-side backstop, not a repeat of that
 * check. That is also why nothing here asks the SDK whether the ad is ready: the Next-Gen SDK has
 * no `isReady`/`canShow`/`isLoaded` at all, and deciding readiness from the module's own `status`
 * is what makes both platforms behave identically.
 *
 * Mirrors `ios/FullScreenAd.swift` beat for beat; the differences are called out where they matter.
 */
abstract class FullScreenAd(
  appContext: AppContext,
  private val adUnitId: String,
  private val requestOptions: Map<String, Any?>?
) : SharedObject(appContext) {

  // Written from GMA callbacks (whichever thread the SDK uses) and read from the JS-side Property
  // getters (JS thread) — a data race, hence @Volatile.
  @Volatile
  private var state = FullScreenLoadState(status = "loading", error = null, responseInfo = null)

  val status: String get() = state.status
  val error: Map<String, Any?>? get() = state.error
  val responseInfo: Map<String, Any?>? get() = state.responseInfo

  /**
   * The promise handed over by `showAsync()`, held only for as long as it is unsettled.
   *
   * An `AtomicReference` rather than iOS's "main thread only" discipline. On iOS every beat that
   * settles the promise is declared `NS_SWIFT_UI_ACTOR`, so main-thread affinity is free; the
   * Android `AdEventCallback` methods carry no such guarantee, and posting each of them to main
   * just to touch this field would delay the `dismissed`/`showed` events for no other reason.
   * `compareAndSet`/`getAndSet` give the one property that actually matters: the promise is settled
   * exactly once, no matter which thread gets there first.
   */
  private val showPromise = AtomicReference<Promise?>(null)

  /**
   * Whether teardown by [sharedObjectDidRelease] has started. `@Volatile` because it is written by
   * whichever thread called `release()` and read from the main thread and from load callbacks —
   * same as `BannerAd.isReleased`.
   */
  @Volatile
  protected var isReleased = false
    private set

  /**
   * Posts to the main thread. Everything that touches the GMA ad object goes through here.
   *
   * [Android counterpart of Lesson 1 — thread affinity] `show(Activity)` and the SDK's own
   * lifecycle work are UI-thread operations, while Expo's sync `Function` and `Constructor` bodies
   * run on the JS thread. None of the entry points below has a return value to wait for, so an
   * async post is enough — deliberately *not* `runOnMain`, which blocks the calling thread.
   */
  protected fun postToMain(block: () -> Unit) {
    mainHandler.post(block)
  }

  // MARK: - Loading

  /** Called from JS as a synchronous `Function` with no return value. */
  fun load() {
    postToMain {
      if (isReleased) {
        // Already released; there is nothing left to present, so loading would only burn a
        // request and leak an ad object.
        return@postToMain
      }
      if (state.status == "shown") {
        // `"shown"` is terminal — these ads are single-use on both SDKs. `load()` is reachable
        // from JS, and without this guard it would start a fresh load on an already-presented ad
        // and walk the status backwards to `"loading"`. On the rewarded format that is a
        // real-money bug: show -> earn -> load -> show -> instant dismiss would resolve with the
        // reward from the *previous* presentation. Refuse, and leave the status where it is.
        return@postToMain
      }
      // Clears the previous ad's event callback and destroys it, plus (on rewarded) any state
      // recorded during a presentation. Nothing to do on the first load; on a retry after an
      // error it stops a stale ad object from emitting into this shared object.
      tearDownAd()
      state = state.copy(status = "loading", error = null)
      emitStatusChange()
      loadAd(AdRequest.Builder(adUnitId).applyRequestOptions(requestOptions).build())
    }
  }

  /**
   * Reports a failure that happened before [load] could run — currently only "the SDK failed to
   * initialize", which the JS side detects. Without it the ad would sit on `loading` forever,
   * because no GMA callback is ever going to fire.
   */
  fun markLoadFailed(message: String) {
    postToMain {
      state = state.copy(
        status = "error",
        error = mapOf("code" to -1, "message" to message, "domain" to "ExpoGoogleMobileAds")
      )
      emitStatusChange()
    }
  }

  /** Subclass hook. Starts the SDK-side load; called on the main thread. */
  protected abstract fun loadAd(request: AdRequest)

  /**
   * Subclass hook. Presents the loaded ad, returning `false` if there is no ad object to present —
   * in which case `showAsync()` rejects rather than leaving its promise pending forever. Called on
   * the main thread.
   */
  protected abstract fun presentAd(activity: Activity): Boolean

  /**
   * Subclass hook. Clears the ad's event callback, calls `destroy()` on it, drops it, and resets
   * any state recorded during a presentation. `destroy()` has no iOS counterpart (ARC), and
   * skipping it is the Android-only way to leak an ad.
   *
   * Called on the main thread from two places: release teardown, and the start of [load] (so a
   * replaced ad object cannot keep emitting into this shared object). Must therefore be safe to
   * call with no ad, and safe to call more than once.
   */
  protected abstract fun tearDownAd()

  /**
   * Subclass hook. What `showAsync()` resolves with on dismissal. Interstitial resolves with
   * nothing; `RewardedAd` overrides this to return the earned reward, or null.
   */
  protected open fun showResult(): Map<String, Any?>? = null

  /** Called by a subclass from its load callback. */
  protected fun handleLoaded(info: ResponseInfo?) {
    state = FullScreenLoadState(status = "loaded", error = null, responseInfo = info.toMap())
    emitStatusChange()
  }

  /** Called by a subclass from its load callback. */
  protected fun handleLoadFailed(adError: LoadAdError) {
    state = state.copy(status = "error", error = adError.toMap())
    emitStatusChange()
  }

  // MARK: - Showing

  /**
   * Presents the ad and hands the promise over to whichever beat settles it.
   *
   * **The promise is settled from four places, and every one of them matters.** A failed
   * presentation never dismisses, so settling only on dismissal leaves it pending forever:
   *
   * 1. [handleDismissed] — resolves (with the reward, on rewarded).
   * 2. [handleFailedToShow] — rejects.
   * 3. Here, synchronously, when there is nothing to present: the ad was already released, a
   *    presentation is already in flight, no Activity is available, or there is no ad object.
   * 4. [sharedObjectDidRelease]'s teardown — the callback is about to be cleared, so no further
   *    event is coming.
   */
  fun showAsync(promise: Promise) {
    postToMain {
      if (isReleased) {
        promise.reject("ERR_AD_RELEASED", "The ad was released before it could be shown.", null)
        return@postToMain
      }
      if (!showPromise.compareAndSet(null, promise)) {
        // Two overlapping show() calls. JS gates on `status`, but both calls can pass that gate
        // before either reaches native, so reject the second rather than orphaning the first
        // promise (the SDK would also fail this with AD_REUSED, but only asynchronously).
        promise.reject("ERR_AD_ALREADY_PRESENTING", "This ad is already being presented.", null)
        return@postToMain
      }
      // [Android-only failure path] `show(Activity)` takes a **non-null** Activity (confirmed
      // @NotNull in the AAR), while `appContext.currentActivity` is nullable — iOS's
      // `present(from:)` takes a nullable view controller and can self-resolve, so it has no
      // equivalent of this branch. Resolved at show time, never cached at construction: an ad may
      // be created before any Activity exists, and a cached one goes stale.
      val activity = appContext?.currentActivity
      if (activity == null) {
        settleShowPromise {
          it.reject(
            "ERR_NO_ACTIVITY",
            "Could not show the ad because no visible Activity was found. " +
              "Try again after the app has finished launching.",
            null
          )
        }
        return@postToMain
      }
      if (!presentAd(activity)) {
        settleShowPromise {
          it.reject(
            "ERR_AD_NOT_AVAILABLE",
            "Could not show the ad because it is no longer available.",
            null
          )
        }
      }
    }
  }

  /** Settles the pending show promise, if there is one, and clears it. Settles at most once. */
  private fun settleShowPromise(settle: (Promise) -> Unit) {
    showPromise.getAndSet(null)?.let(settle)
  }

  // MARK: - AdEventCallback beats, forwarded by the subclasses' callback objects
  //
  // Android's set is not iOS's: the shown beat is a *did*-show here (`onAdShowedFullScreenContent`)
  // where iOS only has `adWillPresentFullScreenContent`, and Android has **no will-dismiss callback
  // at all** — which is why iOS deliberately leaves `adWillDismissFullScreenContent` unused. Only
  // the dismissal beat lines up exactly on both, which is fortunate, because that is the one the
  // show promise depends on.

  protected fun handleShowed() {
    state = state.copy(status = "shown", error = null)
    emitStatusChange()
    emit("showed")
  }

  protected fun handleDismissed() {
    emit("dismissed")
    settleShowPromise { it.resolve(showResult()) }
  }

  protected fun handleFailedToShow(contentError: FullScreenContentError) {
    state = state.copy(status = "error", error = contentError.toMap())
    emitStatusChange()
    settleShowPromise { it.reject("ERR_AD_SHOW_FAILED", contentError.message, null) }
  }

  protected fun handleImpression() {
    emit("impression")
  }

  protected fun handleClicked() {
    emit("clicked")
  }

  /**
   * `paid` is a real interface method here (`AdEventCallback.onAdPaid`), unlike iOS's
   * `paidEventHandler` closure property. `toPaidEventMap()` is the banner's existing micros ->
   * currency-units conversion, reused so the two formats and the two platforms all emit the same
   * `PaidEventValue` shape.
   */
  protected fun handlePaid(adValue: AdValue) {
    emit("paid", adValue.toPaidEventMap())
  }

  private fun emitStatusChange() {
    val snapshot = state
    emit("statusChange", mapOf("status" to snapshot.status, "error" to snapshot.error))
  }

  // MARK: - Release

  /**
   * [Android counterpart of Lesson 3 — release must actually tear things down] `release()` only
   * severs the link to JS; the ad object has to be destroyed here or it leaks.
   *
   * [Android counterpart of Lesson 2] Called synchronously from whichever thread called
   * `release()`, potentially while Expo holds its shared-object registry lock, so this must not
   * block on the main thread — the cleanup is posted, exactly as `BannerAd` does it.
   */
  override fun sharedObjectDidRelease() {
    isReleased = true
    postToMain {
      // The event callback is about to be cleared, so neither a dismissal nor a show failure is
      // going to arrive for an in-flight show(). Settle it here or it never settles.
      settleShowPromise {
        it.reject("ERR_AD_RELEASED", "The ad was released while it was being shown.", null)
      }
      tearDownAd()
    }
  }
}

/**
 * Repeats the two options `BannerAd`'s own `applyRequestOptions` reads. Interstitial and rewarded
 * take the common `AdRequest.Builder(adUnitId)` — there is no `InterstitialAdRequest` or
 * `RewardedAdRequest` in the AAR — so the banner's copy, typed to `BannerAdRequest.Builder`, does
 * not apply. Generalising it to `BaseRequestBuilder<T>` would mean editing `BannerAd.kt`, which is
 * outside this change; the duplication is three lines reading the same two keys of the same JS type
 * (and iOS's `FullScreenAd.makeRequest()` duplicates the same lines for the same reason).
 */
private fun AdRequest.Builder.applyRequestOptions(
  options: Map<String, Any?>?
): AdRequest.Builder {
  if (options == null) return this
  (options["keywords"] as? List<*>)?.forEach { keyword ->
    (keyword as? String)?.let { addKeyword(it) }
  }
  (options["contentUrl"] as? String)?.let { setContentUrl(it) }
  // networkExtras is deliberately unsupported, same as on the banner.
  return this
}

/**
 * A presentation failure, in the shape of the JS-side `AdError`.
 *
 * `getCode()` returns a `FullScreenContentError.ErrorCode` enum, not an Int, so the numeric code
 * comes from its `value`. Like `LoadAdError`, this carries no domain of its own, so the SDK's own
 * `MediationAdError.GOOGLE_MOBILE_ADS_DOMAIN` constant is reused to mean "this came from GMA" —
 * the same choice `LoadAdError.toMap()` already makes.
 */
private fun FullScreenContentError.toMap(): Map<String, Any?> = mapOf(
  "code" to code.value,
  "message" to message,
  "domain" to MediationAdError.GOOGLE_MOBILE_ADS_DOMAIN
)
