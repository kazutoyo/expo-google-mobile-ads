package expo.modules.googlemobileads

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
