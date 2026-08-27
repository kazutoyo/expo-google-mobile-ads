package expo.modules.googlemobileads

import android.content.Context
import android.util.Log
import android.view.View.MeasureSpec
import android.view.ViewGroup
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import java.lang.ref.WeakReference

private const val TAG = "ExpoGoogleMobileAds"

/**
 * The view that displays an ad. addViews the native `AdView` on mount and only removeViews on
 * unmount — the ad (`BannerAd`) itself is never destroyed ([Lesson 7]).
 *
 * Expo/RN's View prop application, layout, and lifecycle callbacks all run on the UI thread,
 * so none of this class's methods need a thread hop (unlike `BannerAd`'s
 * `load()`/`sharedObjectDidRelease()`, this is always called on the main thread).
 *
 * [Review fix — C3] Teardown in `onDetachedFromWindow()` is deliberately not implemented.
 * `react-native-screens` by default only "detaches from the window" an inactive screen rather
 * than "destroying" it — this View instance itself stays alive (and gets reattached to the
 * same window later). `onDetachedFromWindow` can't distinguish a temporary detach from a
 * screen transition from a real unmount, so removeView'ing the `AdView` here would mean that,
 * upon returning to the screen, `setAd()` never gets called again unless the `ad` prop's
 * reference changes (Fabric doesn't reapply a prop whose reference hasn't changed) — leaving
 * it permanently blank because nobody ever addViews it again. iOS has no window-detach
 * teardown hook either. This matches iOS by doing nothing here.
 *
 * iOS's actual per-view destroy hook is `invalidate` (`ExpoFabricViewObjC.mm`'s override,
 * reached deterministically from `RCTMountingManager.mm`'s `Delete` mutation when
 * `ExpoFabricView.shouldBeRecycled() == false`) — not `prepareForRecycle()`, which is never
 * called on Expo Fabric views in RN 0.86 (verified on the simulator: only
 * `didMoveToWindow(window: nil)` and `deinit` fire on unmount). This library does not override
 * `invalidate`; the ownership handback instead runs from `deinit` (see `onDestroy()` below for
 * why that works as the real-teardown signal).
 *
 * This means the case of "this ad genuinely gets taken by another View" is never left
 * unhandled: `setAd()` always calls `(view.parent as? ViewGroup)?.removeView(view)` before
 * addView'ing, regardless of ownership, so the taking side's own `setAd()` guarantees removal
 * from the old parent.
 *
 * [Review fix round 3 — item 3] The case of "really unmounted (but not taken by another View,
 * and not release()d either)" is caught by `OnViewDestroys` (in the `View(BannerAdView::class)`
 * block in `ExpoGoogleMobileAdsModule.kt`). This is a genuine destroy hook called from
 * `onDropViewInstance`, and it does not fire on `react-native-screens`'s temporary window
 * detaches (unlike `onDetachedFromWindow`), so it doesn't contradict the decision above.
 */
class BannerAdView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private var currentAd: BannerAd? = null

  // ExpoView (a LinearLayout) doesn't, by default, trigger a re-layout via requestLayout()
  // when a child View outside Yoga's management is addView'd (see the comment in ExpoView.kt).
  // Setting this flag makes requestLayout() post a measureAndLayout() every time, ensuring
  // this view's own onMeasure/onLayout actually get called.
  override val shouldUseAndroidLayout: Boolean = true

  fun setAd(ad: BannerAd?) {
    // [Review fix — I1] Creates the AdView as soon as this View is mounted and an Activity can
    // be resolved, without waiting for `load()` (the same design as iOS's lazy creation inside
    // setAd). `BannerAdView` can only exist as a real React Native view, and by the time it's
    // mounted the Activity hosting it must exist, so this call almost always succeeds.
    val view = ad?.ensureAdView()

    // [Lesson 5 — don't abandon a stolen ad]
    // `currentAd === ad` alone isn't enough: once another View has taken this ad, the same ad
    // coming back through props (`view`'s parent is no longer self) can never be reclaimed,
    // leaving this View permanently blank
    // (the early return only fires when this view is actually still the one on screen).
    if (currentAd === ad && view != null && view.parent === this) {
      return
    }
    // `handBack = false`: this detach is a reassignment, not a real give-up — see the KDoc on
    // `detachIfOwned()` for why handing back from here would be wrong.
    detachIfOwned(handBack = false)
    currentAd = ad

    // `ensureAdView()` only returns null when there's truly no Activity, or once release()d.
    // In either case there's nothing to show, so do nothing.
    if (ad == null || view == null) return

    // Only warn when another View is still recorded as this ad's owner AND it's actually on
    // screen (attached to a window). GC timing is indeterminate, so a plain remount (the old
    // View instance just hasn't been collected yet) will have either ownership or window
    // detached, and won't warn. Only when both are true is it a real "simultaneous use".
    // `detachIfOwned()` above already cleared our own ownership, so any owner left here is
    // another view. Remember it so the ad can go back when we give it up.
    val otherOwner = ad.currentAttachment
    if (otherOwner != null && otherOwner !== this && view.isAttachedToWindow) {
      Log.w(
        TAG,
        "The same ad was passed to multiple BannerAdViews. Only the most recently mounted View will display it."
      )
    }
    ad.previousAttachment = otherOwner?.let(::WeakReference)
    (view.parent as? ViewGroup)?.removeView(view)
    ad.currentAttachment = this
    addView(view, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
    requestLayout()
  }

  /**
   * Removes the ad from the view only if this view is still its owner. Does nothing if it has
   * already been taken by another view (doesn't steal it back). Called both from `setAd()`'s
   * reassignment path and from `onDestroy()` (when this View is really being destroyed,
   * [Review fix round 3 — item 3]).
   *
   * `handBack` must be `true` only from a real give-up (`onDestroy()`), not from `setAd()`'s
   * reassignment path. `setAd()` also calls this when re-applying the *same* ad to a view that
   * currently isn't showing it (see the early-return guard above it): handing back there would
   * momentarily give the ad to `previousAttachment`, which `setAd()`'s own reassignment then
   * immediately steals back — producing a spurious "same ad in two views" warning and a needless
   * detach/attach churn for no real ownership change. [Review fix — F5]
   */
  private fun detachIfOwned(handBack: Boolean) {
    val ad = currentAd ?: return
    if (ad.currentAttachment !== this) return
    ad.adView?.let { removeView(it) }
    ad.currentAttachment = null
    if (handBack) handBackToPreviousOwner(ad)
  }

  /**
   * Gives an ad that just became unowned back to the view it was taken from, as long as that view
   * is still alive and still wants it (`currentAd === ad`). `setAd()` re-runs the normal attach
   * path, so the reclaiming view becomes the owner again and shows the banner.
   */
  private fun handBackToPreviousOwner(ad: BannerAd) {
    val previous = ad.previousAttachment?.get() ?: return
    if (previous === this || previous.currentAd !== ad) return
    // Cleared first so the re-attach below cannot bounce the ad back and forth.
    ad.previousAttachment = null
    previous.setAd(ad)
  }

  /**
   * Called from `OnViewDestroys` (`onDropViewInstance`), the real teardown hook — it does not fire
   * on the temporary window detaches `react-native-screens` performs during screen transitions.
   * Giving up the ad here is what lets another still-mounted view reclaim it; dropping `currentAd`
   * keeps a destroyed instance from being handed the ad back later. iOS performs the equivalent
   * handback from `deinit` (see `ios/BannerAdView.swift`), not `prepareForRecycle()` — that method
   * is never called on Expo Fabric views in RN 0.86.
   */
  internal fun onDestroy() {
    detachIfOwned(handBack = true)
    val ad = currentAd ?: return
    if (ad.previousAttachment?.get() === this) ad.previousAttachment = null
    currentAd = null
  }

  override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
    super.onLayout(changed, l, t, r, b)
    // Don't touch the AdView if ownership has been lost (taken by another View). Otherwise,
    // every time the old View that lost ownership gets laid out, it would overwrite the frame
    // of the ad that's now being displayed by a different View.
    val ad = currentAd ?: return
    if (ad.currentAttachment !== this) return
    val view = ad.adView ?: return
    view.measure(
      MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
      MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY)
    )
    view.layout(0, 0, width, height)
  }
}
