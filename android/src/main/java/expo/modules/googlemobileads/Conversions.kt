package expo.modules.googlemobileads

import com.google.android.libraries.ads.mobile.sdk.common.AdSourceResponseInfo
import com.google.android.libraries.ads.mobile.sdk.common.AdValue
import com.google.android.libraries.ads.mobile.sdk.common.LoadAdError
import com.google.android.libraries.ads.mobile.sdk.common.MediationAdError
import com.google.android.libraries.ads.mobile.sdk.common.PrecisionType
import com.google.android.libraries.ads.mobile.sdk.common.ResponseInfo

// 実機の ads-mobile-sdk 1.4.0 (AAR を javap で確認) には、Task 6 brief が仮定していた
// `com.google.android.libraries.ads.mobile.sdk.common.AdError` は存在しない。
// トップレベルのロードエラーは `LoadAdError`、ミディエーションアダプター単位のエラーは
// `MediationAdError` に分かれており、フィールド構成も iOS の NSError ベースの AdError とは異なる。

fun ResponseInfo?.toMap(): Map<String, Any?>? {
  if (this == null) return null
  return mapOf(
    "responseId" to responseId,
    // 実際のフィールド名は adapterClassName / loadedAdSourceResponseInfo / adSourceResponses。
    // brief が仮定していた loadedAdapterResponseInfo / adapterResponses という名前は存在しない。
    "mediationAdapterClassName" to loadedAdSourceResponseInfo?.adapterClassName,
    "adSourceName" to loadedAdSourceResponseInfo?.name,
    "adapterResponses" to adSourceResponses.map { it.toMap() }
  )
}

private fun AdSourceResponseInfo.toMap(): Map<String, Any?> = mapOf(
  "adapterClassName" to adapterClassName,
  // AdSourceResponseInfo.latencyMillis は既にミリ秒単位で公開されている
  // （iOS の TimeInterval のような秒単位ではないため *1000 の変換は不要）。
  "latencyMillis" to latencyMillis,
  // description は意図的に含めない: AdSourceResponseInfo に description フィールドは無く、
  // JS 側の AdapterResponse 型も description を持たない（コーディネーターの指示通り）。
  "adError" to adError?.toMap()
)

// アダプター単位のエラー。実際に code: Int, message: String, domain: String を持つのはこちら。
private fun MediationAdError.toMap(): Map<String, Any?> = mapOf(
  "code" to code,
  "message" to message,
  "domain" to domain
)

// トップレベルのロードエラー。`LoadAdError` には domain フィールドが存在しないため
// （iOS の NSError.domain に相当するものが無い）、SDK 自身が公開している定数
// `MediationAdError.GOOGLE_MOBILE_ADS_DOMAIN` を「Google Mobile Ads SDK 自身が返した
// エラーである」ことを表す値として流用する。
fun LoadAdError.toMap(): Map<String, Any?> = mapOf(
  // code は `LoadAdError.ErrorCode` という enum であり、brief が仮定していた素の Int ではない。
  // JS 側の AdError.code は number なので、enum の getValue() で数値に変換する。
  "code" to code.value,
  "message" to message,
  "domain" to MediationAdError.GOOGLE_MOBILE_ADS_DOMAIN,
  "responseInfo" to responseInfo.toMap()
)

/** `PrecisionType` を JS 側の `PaidEventValue.precision` 文字列に変換する。 */
private fun PrecisionType.toJsString(): String = when (this) {
  PrecisionType.UNKNOWN -> "unknown"
  PrecisionType.ESTIMATED -> "estimated"
  PrecisionType.PUBLISHER_PROVIDED -> "publisherProvided"
  PrecisionType.PRECISE -> "precise"
}

/**
 * `paid` イベントのペイロードに変換する。`AdValue.valueMicros` はマイクロ単位の Long
 * （例: 1 米ドル = 1_000_000）なので、JS 側の `PaidEventValue.value`（number, 通貨の実額）
 * に合わせて 1,000,000 で割る。iOS 側は GADAdValue.value が既に実額の NSDecimalNumber
 * なので変換不要だったが、Android は単位が異なる。
 */
fun AdValue.toPaidEventMap(): Map<String, Any?> = mapOf(
  "value" to valueMicros / 1_000_000.0,
  "currencyCode" to currencyCode,
  "precision" to precisionType.toJsString()
)
