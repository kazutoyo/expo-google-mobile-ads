package expo.modules.googlemobileads

import android.content.Context
import android.content.pm.PackageManager

/**
 * config plugin（Task 11）が `AndroidManifest.xml` の meta-data に書いた AdMob App ID を読む。
 *
 * iOS には対応物が不要: GMA iOS SDK は `Info.plist` の `GADApplicationIdentifier` を
 * 自ら読むため、ライブラリが仲介する必要がない。Android の Next-Gen SDK は
 * `InitializationConfig.Builder(appId)` に明示的に渡す必要があるため、この読み出しが要る。
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
        "AdMob の App ID が設定されていません。app.json の expo-google-mobile-ads " +
          "プラグインに androidAppId を指定してください。"
      )
  }
}
