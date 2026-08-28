package expo.modules.googlemobileads

import android.content.Context
import com.google.android.libraries.ads.mobile.sdk.banner.AdSize
import com.google.android.libraries.ads.mobile.sdk.common.AdSourceResponseInfo
import com.google.android.libraries.ads.mobile.sdk.common.AdValue
import com.google.android.libraries.ads.mobile.sdk.common.LoadAdError
import com.google.android.libraries.ads.mobile.sdk.common.MediationAdError
import com.google.android.libraries.ads.mobile.sdk.common.PrecisionType
import com.google.android.libraries.ads.mobile.sdk.common.ResponseInfo

// The real ads-mobile-sdk 1.4.0 (checked against the AAR via javap) has no
// `com.google.android.libraries.ads.mobile.sdk.common.AdError`, which the Task 6 brief had
// assumed existed. Top-level load errors are `LoadAdError`, and per-mediation-adapter errors
// are `MediationAdError` — a different split, with different fields, from iOS's NSError-based
// AdError.

/**
 * Mirror of the JS-side `BannerAdAdaptiveKind` (see `src/BannerAdSize.ts`) and of iOS's
 * `BannerAdSizeKind`. A size that carries one of these must be rebuilt through the matching
 * factory: `AdSize(width, height)`'s bytecode passes false for all three adaptive flags
 * (`isAnchoredAdaptiveBanner` / `isInlineAdaptiveBanner` / `isLargeAnchoredAdaptiveBanner`), so
 * rebuilding an adaptive size with it tells Google's serving side "custom WxH" rather than
 * "adaptive". The only public constructor is that fixed one — the flag-carrying constructor is
 * package-private (checked against the AAR with javap) — so the factories are the only way in.
 *
 * The orientation is part of the kind because each anchored factory returns a different height
 * for the same width; rebuilding an explicitly portrait size through the current-orientation
 * factory on a landscape device would silently retarget the request.
 */
enum class BannerAdSizeKind(val jsValue: String) {
  ANCHORED("anchored"),
  ANCHORED_PORTRAIT("anchoredPortrait"),
  ANCHORED_LANDSCAPE("anchoredLandscape"),
  LARGE_ANCHORED("largeAnchored"),
  LARGE_ANCHORED_PORTRAIT("largeAnchoredPortrait"),
  LARGE_ANCHORED_LANDSCAPE("largeAnchoredLandscape"),
  INLINE("inline");

  companion object {
    fun fromJsValue(value: String?): BannerAdSizeKind? =
      entries.firstOrNull { it.jsValue == value }
  }
}

/**
 * The single place the SDK's adaptive size factories are called. Both the module's size functions
 * and [BannerAd]'s reconstruction of a size that crossed the JS boundary go through here, so the
 * two can never disagree. Mirrors iOS's `makeAdaptiveAdSize`.
 *
 * The anchored factories read screen metrics, so callers hop to the main thread first.
 * `maxHeight` is only read for [BannerAdSizeKind.INLINE]; the anchored factories derive their own
 * height. None of them needs an Activity — a plain `Context` is enough.
 */
fun makeAdaptiveAdSize(
  context: Context,
  kind: BannerAdSizeKind,
  width: Int,
  maxHeight: Int
): AdSize = when (kind) {
  BannerAdSizeKind.ANCHORED ->
    AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(context, width)
  BannerAdSizeKind.ANCHORED_PORTRAIT ->
    AdSize.getPortraitAnchoredAdaptiveBannerAdSize(context, width)
  BannerAdSizeKind.ANCHORED_LANDSCAPE ->
    AdSize.getLandscapeAnchoredAdaptiveBannerAdSize(context, width)
  BannerAdSizeKind.LARGE_ANCHORED ->
    AdSize.getLargeAnchoredAdaptiveBannerAdSize(context, width)
  BannerAdSizeKind.LARGE_ANCHORED_PORTRAIT ->
    AdSize.getLargePortraitAnchoredAdaptiveBannerAdSize(context, width)
  BannerAdSizeKind.LARGE_ANCHORED_LANDSCAPE ->
    AdSize.getLargeLandscapeAnchoredAdaptiveBannerAdSize(context, width)
  BannerAdSizeKind.INLINE ->
    AdSize.getInlineAdaptiveBannerAdSize(width, maxHeight)
}

fun ResponseInfo?.toMap(): Map<String, Any?>? {
  if (this == null) return null
  return mapOf(
    "responseId" to responseId,
    // The actual field names are adapterClassName / loadedAdSourceResponseInfo /
    // adSourceResponses. The brief's assumed names, loadedAdapterResponseInfo / adapterResponses,
    // don't exist.
    "mediationAdapterClassName" to loadedAdSourceResponseInfo?.adapterClassName,
    "adSourceName" to loadedAdSourceResponseInfo?.name,
    "adapterResponses" to adSourceResponses.map { it.toMap() }
  )
}

private fun AdSourceResponseInfo.toMap(): Map<String, Any?> = mapOf(
  "adapterClassName" to adapterClassName,
  // AdSourceResponseInfo.latencyMillis is already exposed in milliseconds
  // (unlike iOS's TimeInterval-based seconds, so no *1000 conversion is needed).
  "latencyMillis" to latencyMillis,
  // description is deliberately omitted: AdSourceResponseInfo has no description field, and
  // the JS-side AdapterResponse type doesn't have one either (per the coordinator's instructions).
  "adError" to adError?.toMap()
)

// A per-adapter error. This is the one that actually has code: Int, message: String, domain: String.
private fun MediationAdError.toMap(): Map<String, Any?> = mapOf(
  "code" to code,
  "message" to message,
  "domain" to domain
)

// A top-level load error. `LoadAdError` has no domain field
// (there's nothing corresponding to iOS's NSError.domain), so the constant the SDK itself
// exposes, `MediationAdError.GOOGLE_MOBILE_ADS_DOMAIN`, is reused here as a value meaning
// "this error came from the Google Mobile Ads SDK itself".
fun LoadAdError.toMap(): Map<String, Any?> = mapOf(
  // code is a `LoadAdError.ErrorCode` enum, not the plain Int the brief had assumed.
  // The JS-side AdError.code is a number, so convert via the enum's getValue().
  "code" to code.value,
  "message" to message,
  "domain" to MediationAdError.GOOGLE_MOBILE_ADS_DOMAIN,
  "responseInfo" to responseInfo.toMap()
)

/** Converts `PrecisionType` to the JS-side `PaidEventValue.precision` string. */
private fun PrecisionType.toJsString(): String = when (this) {
  PrecisionType.UNKNOWN -> "unknown"
  PrecisionType.ESTIMATED -> "estimated"
  PrecisionType.PUBLISHER_PROVIDED -> "publisherProvided"
  PrecisionType.PRECISE -> "precise"
}

/**
 * Converts to the `paid` event's payload. `AdValue.valueMicros` is a `Long` in micros
 * (e.g. 1 USD = 1_000_000), so divide by 1,000,000 to match the JS-side
 * `PaidEventValue.value` (a number, the actual currency amount). iOS needed no conversion
 * here since GADAdValue.value is already an actual-amount NSDecimalNumber, but Android uses a
 * different unit.
 */
fun AdValue.toPaidEventMap(): Map<String, Any?> = mapOf(
  "value" to valueMicros / 1_000_000.0,
  "currencyCode" to currencyCode,
  "precision" to precisionType.toJsString()
)
