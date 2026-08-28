package expo.modules.googlemobileads

import android.app.Activity
import android.content.Context
import com.google.android.ump.ConsentDebugSettings
import com.google.android.ump.ConsentInformation
import com.google.android.ump.ConsentRequestParameters
import com.google.android.ump.FormError
import com.google.android.ump.UserMessagingPlatform

/**
 * Maps a UMP [FormError] onto the JS-facing `ConsentErrorCode`.
 *
 * The numeric codes cannot be sent to JS as-is: Android's `FormError.ErrorCode` numbers `2` as
 * `INTERNET_ERROR`, while iOS's `UMPErrorDomain` numbers `2` as `invalidAppID`. The same number
 * would mean two different failures depending on the platform.
 *
 * Android's set is much smaller than iOS's — there is no equivalent of `misconfiguration` or
 * `formUnavailable`, which is documented on `ConsentErrorCode` in types.ts.
 */
fun consentErrorCode(code: Int): String = when (code) {
  1 -> "internal"          // INTERNAL_ERROR
  2 -> "network"           // INTERNET_ERROR
  3 -> "invalidOperation"  // INVALID_OPERATION
  4 -> "timeout"           // TIME_OUT
  else -> "unknown"
}

fun consentErrorMessage(error: FormError): String =
  "${error.message} (native code: ${error.errorCode})"

fun consentInformation(context: Context): ConsentInformation =
  UserMessagingPlatform.getConsentInformation(context)

fun consentSnapshot(context: Context): Map<String, Any?> {
  val info = consentInformation(context)
  return mapOf(
    "status" to when (info.consentStatus) {
      ConsentInformation.ConsentStatus.REQUIRED -> "required"
      ConsentInformation.ConsentStatus.NOT_REQUIRED -> "notRequired"
      ConsentInformation.ConsentStatus.OBTAINED -> "obtained"
      else -> "unknown"
    },
    "canRequestAds" to info.canRequestAds(),
    // iOS narrows its three-valued formStatus to this same boolean. See
    // `ConsentInfo.isConsentFormAvailable` in types.ts.
    "isConsentFormAvailable" to info.isConsentFormAvailable,
    "privacyOptionsRequirement" to when (info.privacyOptionsRequirementStatus) {
      ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED -> "required"
      ConsentInformation.PrivacyOptionsRequirementStatus.NOT_REQUIRED -> "notRequired"
      else -> "unknown"
    }
  )
}

fun makeConsentRequestParameters(
  activity: Activity,
  options: Map<String, Any?>?
): ConsentRequestParameters {
  val builder = ConsentRequestParameters.Builder()
  if (options == null) return builder.build()

  (options["tagForUnderAgeOfConsent"] as? Boolean)?.let(builder::setTagForUnderAgeOfConsent)

  (options["debugSettings"] as? Map<*, *>)?.let { debug ->
    val debugBuilder = ConsentDebugSettings.Builder(activity)
    (debug["testDeviceIds"] as? List<*>)?.filterIsInstance<String>()?.forEach {
      debugBuilder.addTestDeviceHashedId(it)
    }
    (debug["geography"] as? String)?.let { geography ->
      debugBuilder.setDebugGeography(
        when (geography) {
          "eea" -> ConsentDebugSettings.DebugGeography.DEBUG_GEOGRAPHY_EEA
          "regulatedUsState" ->
            ConsentDebugSettings.DebugGeography.DEBUG_GEOGRAPHY_REGULATED_US_STATE
          "other" -> ConsentDebugSettings.DebugGeography.DEBUG_GEOGRAPHY_OTHER
          // DEBUG_GEOGRAPHY_NOT_EEA is deprecated in favour of OTHER and is deliberately not
          // reachable from JS — `DebugGeography` in types.ts has no member for it.
          else -> ConsentDebugSettings.DebugGeography.DEBUG_GEOGRAPHY_DISABLED
        }
      )
    }
    // `setForceTesting` is deliberately not exposed: iOS has no equivalent, and an emulator is
    // already treated as a test device, so QA does not need it.
    builder.setConsentDebugSettings(debugBuilder.build())
  }

  // `setAdMobAppId` is deliberately not exposed either: iOS has no equivalent, and the app ID is
  // already injected into AndroidManifest.xml by the config plugin.
  return builder.build()
}
