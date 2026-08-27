package expo.modules.googlemobileads

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.ViewGroup
import java.lang.ref.WeakReference
import com.google.android.libraries.ads.mobile.sdk.banner.AdSize
import com.google.android.libraries.ads.mobile.sdk.banner.AdView
import com.google.android.libraries.ads.mobile.sdk.banner.BannerAdEventCallback
import com.google.android.libraries.ads.mobile.sdk.banner.BannerAdRefreshCallback
import com.google.android.libraries.ads.mobile.sdk.banner.BannerAdRequest
import com.google.android.libraries.ads.mobile.sdk.common.AdLoadCallback
import com.google.android.libraries.ads.mobile.sdk.common.AdValue
import com.google.android.libraries.ads.mobile.sdk.common.LoadAdError
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.sharedobjects.SharedObject
import com.google.android.libraries.ads.mobile.sdk.banner.BannerAd as GmaBannerAd

private val mainHandler = Handler(Looper.getMainLooper())
private const val TAG = "ExpoGoogleMobileAds"

/**
 * Thrown when `size` doesn't contain numeric width/height. Same idea as iOS's
 * `InvalidBannerSizeException`: don't silently degrade a configuration mistake to a 0x0
 * banner via `?: 0` — surface it to the caller as an exception.
 */
class InvalidBannerSizeException :
  CodedException(message = "BannerAd's size requires numeric width and height")

/**
 * [Review fix — I4] Bundles `status`/`error`/`loadedSize`/`responseInfo` into a single
 * immutable snapshot exposed through one `@Volatile` reference. Marking each field
 * `@Volatile` individually would guarantee per-field visibility, but not consistency across
 * the group of fields read together.
 *
 * [Review fix round 2 — item 5, correcting the guarantee]
 * What this guarantees is consistency only **within a single read** on the native side (e.g.
 * `emitStatusChange()` reads `state` into a local variable exactly once, and builds
 * `status`/`error` from that one snapshot, so within a single event payload the pair is
 * always consistent). The JS side reads `ad.status` and `ad.error` as **separate calls**
 * through Expo's `Property` mechanism, so a native-side write landing between those two calls
 * can still produce an inconsistent pair like `{status: "error", error: null}`. This is the
 * same constraint iOS has, and is not a regression introduced by this change.
 * [Review fix round 3 — item 5, correcting the reference] iOS closes only the data race on
 * these getters with an `NSLock` (`ios/BannerAd.swift`'s `stateLock`), not by serializing onto
 * the main thread via `runOnMain`. However, `status`/`error`/`loadedSize`/`responseInfo` are
 * each independent properties whose getters lock/unlock individually — it does not provide an
 * atomic read across multiple properties. In other words, iOS carries the exact same
 * constraint: a write landing between two calls can still produce an inconsistent pair.
 */
private data class LoadState(
  val status: String,
  val error: Map<String, Any?>?,
  val loadedSize: Map<String, Any?>?,
  val responseInfo: Map<String, Any?>?
)

/**
 * An ad instance that can be held and loaded without being placed in the view hierarchy.
 * `BannerAdView` addViews `adView` on mount and only removeViews on unmount — it never
 * destroys it, which is what lets it survive across screen transitions (a core assumption of
 * this library).
 *
 * Confirmed approach 1 (verified on an API 36 emulator in Task 0): `loadAd()` succeeds even
 * on an `AdView` that has never been addView'd to a window, and addView'ing it later displays
 * it correctly with no reload needed. That's why this holds onto an `AdView` instance and
 * calls `AdView.loadAd()`, rather than using the deprecated static `BannerAd.load(request,
 * callback)` API.
 */
class BannerAd(
  appContext: AppContext,
  private val adUnitId: String,
  private val requestedWidth: Int,
  private val requestedHeight: Int,
  /** The JS-side `BannerAdSize.adaptiveKind`, or null for a fixed size. */
  private val adaptiveKind: BannerAdSizeKind?,
  private val requestOptions: Map<String, Any?>?
) : SharedObject(appContext) {

  val requestedSizeMap: Map<String, Any?> = buildMap {
    put("width", requestedWidth)
    put("height", requestedHeight)
    // Kept in `ad.size` so JS sees the same keys as on iOS, and so a size read back off an ad
    // still round-trips into another ad as the same adaptive request. Omitted rather than set to
    // null for a fixed size, so JS sees `undefined` on both platforms, matching the optional
    // `adaptiveKind` in the TypeScript type.
    adaptiveKind?.let { put("adaptiveKind", it.jsValue) }
  }

  /**
   * The `AdSize` the request is built from, resolved once on first [load].
   *
   * Deliberately not built in the constructor, mirroring iOS's lazy `bannerView`: the anchored
   * adaptive factories read screen metrics, and the constructor runs synchronously on the JS
   * thread during a React render. Building it here means the resolution happens on the main
   * thread that [load] already posts to, instead of adding another blocking JS-thread-to-main
   * hop. Only ever touched from that main-thread Runnable, so it needs no synchronization.
   *
   * Resolved once and cached rather than per load, so a retry after a rotation cannot request a
   * different size from the one `ad.size` told the caller to reserve space for (`useBannerAdSize`
   * recreates the ad on rotation, which is what re-resolves it).
   */
  private var adSize: AdSize? = null

  /**
   * Held without being placed in the view hierarchy. `BannerAdView` addViews it when
   * displaying. `@Volatile` because it's read/written both from `load()` (a main-thread
   * Runnable) and `sharedObjectDidRelease()` (whichever thread called release(), typically
   * the JS thread).
   */
  @Volatile
  var adView: AdView? = null
    private set

  /**
   * The `BannerAdView` currently displaying this ad. Used to decide ownership (Lesson 5).
   * Always read/written through `BannerAdView`'s methods, which are always called from the
   * UI thread (Expo/RN's View prop application and lifecycle callbacks are always on the UI
   * thread), so `@Volatile` isn't needed here.
   *
   * [Review fix round 2 — item 3 → reverted in round 3]
   * This was briefly made a `WeakReference`, but review correctly pointed out it was a no-op:
   * the `AdView` that `BannerAd.adView` (a strong reference) points to has a `View.mParent`
   * (set by `ViewGroup.addViewInner`, a plain strong-reference field) that is never cleared by
   * a window detach unless `removeView` is called. In this library, `currentAttachment` always
   * points to the same `BannerAdView` as `adView.parent`, so weakening the reference wouldn't
   * let `currentAttachmentRef.get()` become null via GC in practice (zero reduction in leaks,
   * just an extra layer of indirection). The real fix isn't "weaken the reference" but
   * "`removeView` at a deterministic time", which is what the `OnViewDestroys` hook in
   * `ExpoGoogleMobileAdsModule.kt` (calling `BannerAdView.detachIfOwned()`) handles. Since
   * `mParent` is actually nulled out there, there's no reason to keep this weak, so it's back
   * to a plain strong reference.
   */
  var currentAttachment: BannerAdView? = null

  /**
   * The view `currentAttachment` took this ad from. When the current owner gives the ad up, it is
   * handed back to this view if that view is still alive and still wants the ad — otherwise a view
   * that lost the ad to a second view would stay blank forever, because its `ad` prop never changes
   * and Fabric therefore never calls `setAd` on it again.
   *
   * `WeakReference`, matching iOS's `weak var previousAttachment`. This does NOT transfer the
   * "a plain reference costs nothing" reasoning that applies to `currentAttachment` below:
   * `BannerAd -> adView -> (mParent) -> BannerAdView` keeps `currentAttachment`'s view reachable
   * regardless, but the view referenced here is by definition no longer `adView.parent` — that is
   * the whole point of the field — so nothing else pins it. A strong reference here would retain a
   * destroyed view (and, through it, its Activity) whenever the view that recorded it is torn down
   * without itself being the current owner (so `BannerAdView.onDestroy()` cannot clear this field
   * for it) — see `detachIfOwned()`'s `handBack` parameter for the related ownership-timing fix.
   */
  var previousAttachment: WeakReference<BannerAdView>? = null

  /**
   * Whether teardown by `sharedObjectDidRelease()` has completed. Once true, a new `AdView`
   * is never created again. `@Volatile` because it's touched both by whichever thread calls
   * release() (write) and by `load()` on the main thread (read).
   */
  @Volatile
  private var isReleased = false

  // [Review fix — I4] Exposes the 4 fields bundled as LoadState through a single @Volatile
  // reference. Written from GMA callbacks (main thread) and read from the JS-side Property
  // getter (JS thread) — a data race (Lesson 6).
  @Volatile
  private var state = LoadState(status = "loading", error = null, loadedSize = null, responseInfo = null)

  val status: String get() = state.status
  val error: Map<String, Any?>? get() = state.error
  val loadedSize: Map<String, Any?>? get() = state.loadedSize
  val responseInfo: Map<String, Any?>? get() = state.responseInfo

  /**
   * [Review fix — I1] Creates the `AdView` as soon as the Activity can be resolved, even if
   * `BannerAdView` mounts before `load()` runs (the same design as iOS's lazy creation inside
   * `setAd`). Called from both `load()` and `BannerAdView.setAd()`, but both calls always
   * happen on the UI thread (`load()` is already posted to main; `setAd` is always on the UI
   * thread via Fabric's prop application), so creation itself needs no extra synchronization.
   *
   * `BannerAdView` can only exist as a real React Native view, and by the time it's mounted
   * the Activity hosting it must already exist (otherwise there'd be no window to draw into).
   * So in practice a call from `setAd()` failing to get an Activity essentially never happens
   * — the only real window is "preloaded, but `load()`'s main Runnable hasn't run yet",
   * which `setAd`'s own call covers too.
   */
  internal fun ensureAdView(): AdView? {
    if (isReleased) return null
    adView?.let { return it }
    val activity = appContext?.currentActivity ?: return null
    return AdView(activity).also { adView = it }
  }

  /**
   * [Android counterpart of Lesson 1 — thread affinity]
   * Creating an `AdView` (a `FrameLayout` subclass) and calling `loadAd()` are UI-thread-only
   * operations. Creating a `View` on a thread with no Looper (like the JS thread) can crash,
   * e.g. while creating an internal `Handler`. Meanwhile the JS-side `Function("load")` is
   * called synchronously from the JS thread. Since `load()` has no return value, there's no
   * reason to block the JS thread waiting for main to finish — an async post is enough (the
   * same call the latest iOS version made, switching from `DispatchQueue.main.sync` to
   * `DispatchQueue.main.async`).
   */
  fun load() {
    mainHandler.post {
      if (isReleased) {
        // Already release()d. Nothing left to show, so do nothing.
        return@post
      }

      // [Android counterpart of Lesson 4] Equivalent to rootViewController. Since
      // `ensureAdView()` re-resolves `appContext?.currentActivity` every time, an Activity
      // fixed at init time (which may not exist yet during preload) can never come back once
      // it's gone stale.
      val view = ensureAdView()
      if (view == null) {
        setError(
          "Could not load the ad because no visible Activity was found. " +
            "Try again after the app finishes launching, or after BannerAdView has mounted, and " +
            "call load() again."
        )
        return@post
      }

      state = state.copy(status = "loading", error = null)
      emitStatusChange()

      // `AdSize(width, height)` builds a *fixed* size: its bytecode passes false for all three
      // adaptive flags. Feeding it an adaptive size's numbers silently turns "anchored adaptive"
      // / "up to this height" into "exactly this size", so every adaptive kind is rebuilt through
      // its own factory instead. See `BannerAdAdaptiveKind` in BannerAdSize.ts.
      val adSize = this.adSize ?: resolveAdSize(view.context).also { this.adSize = it }

      val request = BannerAdRequest.Builder(adUnitId, adSize)
        .applyRequestOptions(requestOptions)
        .build()

      view.loadAd(
        request,
        object : AdLoadCallback<GmaBannerAd> {
          override fun onAdLoaded(ad: GmaBannerAd) = onAdReady(ad)

          override fun onAdFailedToLoad(adError: LoadAdError) = onAdFailed(adError)
        }
      )
    }
  }

  /** Main thread only — see [adSize]. `view.context` is the Activity the AdView was created with. */
  private fun resolveAdSize(context: Context): AdSize =
    if (adaptiveKind == null) {
      AdSize(requestedWidth, requestedHeight)
    } else {
      makeAdaptiveAdSize(context, adaptiveKind, requestedWidth, requestedHeight)
    }

  /**
   * `loadedSize` is typed `BannerAdSize` on the JS side, and a `BannerAdSize` without its
   * adaptive marker rebuilds as a *fixed custom* request. Carrying the requested kind through
   * keeps `useBannerAd({ size: ad.loadedSize })` an adaptive request instead of silently
   * degrading it. The requested kind is reported rather than one derived from the loaded
   * `AdSize`'s three booleans, because those cannot say which orientation the size was built for
   * — and because it is the requested kind that reproduces this ad's request. Matches iOS's
   * `loadedSizeMap`.
   */
  private fun loadedSizeMap(size: AdSize): Map<String, Any?> = buildMap {
    put("width", size.width)
    put("height", size.height)
    adaptiveKind?.let { put("adaptiveKind", it.jsValue) }
  }

  /**
   * [Review fix — C2] Common handling for both an initial successful load and a successful
   * auto-refresh. The Next-Gen SDK's auto-refresh doesn't "update the same `GmaBannerAd`
   * instance" — it "swaps in a new `GmaBannerAd` instance" — so `adEventCallback` and
   * `bannerAdRefreshCallback` must be rebound to that new instance every time. Otherwise,
   * after the first refresh, impression/clicked/paid events would never fire again, and
   * subsequent refresh notifications would also stop arriving (`onAdRefreshed()` takes no
   * callback argument, so the latest instance must be re-fetched from `AdView.getBannerAd()`).
   */
  private fun onAdReady(ad: GmaBannerAd) {
    state = state.copy(
      status = "loaded",
      error = null,
      loadedSize = loadedSizeMap(ad.getAdSize()),
      responseInfo = ad.getResponseInfo().toMap()
    )

    ad.adEventCallback = object : BannerAdEventCallback {
      override fun onAdImpression() {
        emit("impression")
      }

      override fun onAdClicked() {
        emit("clicked")
      }

      override fun onAdPaid(adValue: AdValue) {
        emit("paid", adValue.toPaidEventMap())
      }
    }

    ad.bannerAdRefreshCallback = object : BannerAdRefreshCallback {
      override fun onAdRefreshed() {
        // [Review fix round 2 — item 2 → corrected in round 3]
        // This used to call `setError()` when null here, but that lies to JS: at this point
        // the banner that loaded successfully just before is still on screen — nothing is
        // actually broken. Setting `status: "error"` would make the
        // `useBannerAdState`/`{isLoaded && <BannerAdView/>}` pattern unmount a banner that's
        // working fine, and there's no longer a way to rebind `adEventCallback`/
        // `bannerAdRefreshCallback`, so it could never recover afterward. iOS also has no
        // corresponding branch, so this would be an Android-only synthetic error. "Refresh
        // stopped" is a degradation, not a failure, so leave the state untouched entirely and
        // only log it (for diagnosing a path that shouldn't be reachable — right after
        // `onAdRefreshed()` fires, `adView` should always hold a new ad).
        val refreshed = adView?.getBannerAd()
        if (refreshed != null) {
          onAdReady(refreshed)
        } else {
          Log.w(
            TAG,
            "AdView.getBannerAd() returned null after an ad auto-refresh. " +
              "Further auto-refresh events won't arrive, but the currently displayed banner remains valid."
          )
        }
      }

      override fun onAdFailedToRefresh(adError: LoadAdError) = onAdFailed(adError)
    }

    emitStatusChange()
  }

  private fun onAdFailed(adError: LoadAdError) {
    state = state.copy(status = "error", error = adError.toMap())
    emitStatusChange()
  }

  /**
   * Reports a failure that happened before `load()` could even run — currently only "the SDK
   * failed to initialize", which the JS side detects. Without this the ad would sit on
   * `loading` forever with no error anywhere, since no GMA callback is ever going to fire.
   *
   * Posted to main for the same reason as [load]: this is called synchronously from the JS
   * thread, and every other write to the state/`statusChange` pair happens on main.
   */
  fun markLoadFailed(message: String) {
    mainHandler.post { setError(message) }
  }

  private fun setError(message: String) {
    // [Review fix — Minor] Aligned wording with iOS ("ExpoGoogleMobileAds", matching iOS's
    // resolveRootViewController() failure, rather than "expo-google-mobile-ads").
    state = state.copy(status = "error", error = mapOf("code" to -1, "message" to message, "domain" to "ExpoGoogleMobileAds"))
    emitStatusChange()
  }

  private fun emitStatusChange() {
    val snapshot = state
    emit("statusChange", mapOf("status" to snapshot.status, "error" to snapshot.error))
  }

  /**
   * [Android counterpart of Lesson 3 — release must actually tear things down]
   * `release()` only severs the link to JS and does no native-side cleanup on its own, so
   * here we remove it from its view and destroy it. [Review fix — Minor] Also clears
   * `adEventCallback` and `currentAttachment` (the `AdView` itself is destroyed anyway so the
   * actual harm is small, but this avoids leaving stale callback references or ownership
   * info behind after teardown).
   *
   * [Android counterpart of Lesson 2 — don't wait on another thread while holding a lock]
   * On iOS, `sharedObjectWillRelease()` is called while holding the registry's mutex, which
   * is why `DispatchQueue.main.sync` there can deadlock. Actually reading
   * `SharedObjectRegistry.kt` (expo-modules-core Android, `delete(id)`) shows a
   * `synchronized(this) { pairs.remove(id) }` block that finishes and releases the lock
   * *before* calling `.let { it.sharedObjectDidRelease() }` — on Android the registry lock is
   * not held while `sharedObjectDidRelease()` runs (a different implementation from iOS).
   * That said, `release()` itself is still called synchronously from an arbitrary thread
   * (typically the JS thread), so there's no reason to block that thread waiting for main to
   * finish — kept as an async post, same as the iOS version.
   */
  override fun sharedObjectDidRelease() {
    isReleased = true
    // [Review fix round 2 — item 4, fixing a landmine in round 3]
    // `currentAttachment` is a UI-thread-only field (see the comment above), but
    // `sharedObjectDidRelease()` itself is called from whichever thread called release()
    // (typically the JS thread), so like the rest of teardown it's written inside the post to
    // main. This used to evaluate `val view = adView ?: return` first, so if release() was
    // called while `adView` was still unset (i.e. `load()`/`ensureAdView()` had never
    // succeeded), the post itself would never fire and clearing `currentAttachment` would be
    // skipped along with it — a dud (in practice harmless so far, since `currentAttachment`
    // is never set without `adView` either, but worth fixing anyway). The `adView` null check
    // has been moved inside the post, and clearing `currentAttachment` now always runs.
    mainHandler.post {
      currentAttachment = null
      previousAttachment = null
      val view = adView ?: return@post
      // Clear bannerAdRefreshCallback along with adEventCallback.
      view.getBannerAd()?.let {
        it.adEventCallback = null
        it.bannerAdRefreshCallback = null
      }
      (view.parent as? ViewGroup)?.removeView(view)
      view.destroy()
    }
  }
}

private fun BannerAdRequest.Builder.applyRequestOptions(
  options: Map<String, Any?>?
): BannerAdRequest.Builder {
  if (options == null) return this
  (options["keywords"] as? List<*>)?.forEach { keyword ->
    (keyword as? String)?.let { addKeyword(it) }
  }
  (options["contentUrl"] as? String)?.let { setContentUrl(it) }
  // networkExtras is deliberately unsupported (also deliberately excluded from the JS-side
  // RequestOptions type).
  return this
}
