package expo.modules.googlemobileads

import android.content.Context
import android.content.pm.PackageManager

/**
 * Reads the AdMob App ID that the config plugin (Task 11) wrote into
 * `AndroidManifest.xml`'s meta-data.
 *
 * No iOS counterpart is needed: the GMA iOS SDK reads `Info.plist`'s
 * `GADApplicationIdentifier` itself, so the library doesn't need to mediate. The Android
 * Next-Gen SDK requires it to be passed explicitly to `InitializationConfig.Builder(appId)`,
 * which is why this lookup is necessary.
 */
object AppIdProvider {
  private const val META_DATA_KEY = "com.google.android.gms.ads.APPLICATION_ID"

  @Suppress("DEPRECATION")
  fun get(context: Context): String {
    val appInfo = context.packageManager.getApplicationInfo(
      context.packageName,
      PackageManager.GET_META_DATA
    )
    return appInfo.metaData?.getString(META_DATA_KEY)
      ?: throw IllegalStateException(
        "The AdMob App ID is not set. Specify androidAppId in the @kazutoyo/expo-google-mobile-ads " +
          "plugin config in app.json."
      )
  }
}
