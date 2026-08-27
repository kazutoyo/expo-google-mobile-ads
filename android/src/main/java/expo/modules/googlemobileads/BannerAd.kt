package expo.modules.googlemobileads

import android.os.Handler
import android.os.Looper
import android.view.ViewGroup
import com.google.android.libraries.ads.mobile.sdk.banner.AdSize
import com.google.android.libraries.ads.mobile.sdk.banner.AdView
import com.google.android.libraries.ads.mobile.sdk.banner.BannerAdEventCallback
import com.google.android.libraries.ads.mobile.sdk.banner.BannerAdRequest
import com.google.android.libraries.ads.mobile.sdk.common.AdLoadCallback
import com.google.android.libraries.ads.mobile.sdk.common.AdValue
import com.google.android.libraries.ads.mobile.sdk.common.LoadAdError
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.sharedobjects.SharedObject
import com.google.android.libraries.ads.mobile.sdk.banner.BannerAd as GmaBannerAd

private val mainHandler = Handler(Looper.getMainLooper())

/**
 * `size` に数値の width/height が含まれていない場合のエラー。iOS 版の
 * `InvalidBannerSizeException` と同じ考え方: 設定ミスを `?: 0` で 0x0 のバナーへ静かに
 * 縮退させず、呼び出し側に例外として伝える。
 */
class InvalidBannerSizeException :
  CodedException(message = "BannerAd の size には数値の width と height が必要です")

/**
 * ビュー階層に入れずに保持・ロードできる広告インスタンス。`BannerAdView` がマウント時に
 * `adView` を addView し、アンマウント時は removeView するだけ — 破棄はしない。
 * これにより画面遷移をまたいで再利用できる（ライブラリの中心的な前提）。
 *
 * 検証済みの方式1（Task 0 で API 36 エミュレータ上で確認）: 一度も window に addView
 * されていない `AdView` でも `loadAd()` は成功し、後から addView しても再ロードなしで
 * 正しく表示される。そのため `BannerAd.load(request, callback)`（非推奨の静的 API）は
 * 使わず、`AdView` インスタンスを保持して `AdView.loadAd()` を呼ぶ。
 */
class BannerAd(
  appContext: AppContext,
  private val adUnitId: String,
  private val requestedSize: AdSize,
  private val requestOptions: Map<String, Any?>?
) : SharedObject(appContext) {

  val requestedSizeMap: Map<String, Any?> =
    mapOf("width" to requestedSize.width, "height" to requestedSize.height)

  /**
   * ビュー階層に入れずに保持する。表示時に `BannerAdView` が addView する。
   *
   * [Lesson 4 の Android 版 — Activity は preload 時点では存在しないことがある]
   * `AdView` の生成には実 Activity（`Context` ではなく）が必要なため、Constructor の
   * 時点では作らない。`load()` が呼ばれ、かつそのタイミングで Activity が解決できた
   * 最初の瞬間に一度だけ作る。`release()` 済みなら [isReleased] により二度と作らない。
   * `BannerAdView` はこれが null の間は「表示するものがまだ無い」とみなして何もしない
   * （iOS 最新版の `bannerView: BannerView?` と同じ設計）。
   *
   * `load()`（main スレッドの Runnable）と `sharedObjectDidRelease()`（release() を
   * 呼んだ任意のスレッド、典型的には JS スレッド）の両方から読み書きされるため `@Volatile`。
   */
  @Volatile
  var adView: AdView? = null
    private set

  /**
   * 現在この広告を表示している `BannerAdView`。所有権の判定に使う（Lesson 5）。
   * 読み書きは常に `BannerAdView` のメソッド経由で、それらは常に UI スレッドから
   * 呼ばれる（Expo/RN の View prop 適用・ライフサイクルコールバックは UI スレッド固定）
   * ため `@Volatile` は不要。
   */
  var currentAttachment: BannerAdView? = null

  /**
   * `sharedObjectDidRelease()` によるテアダウンが済んだかどうか。true になったら
   * 二度と `AdView` を作り直さない。release() を呼んだスレッド（書き込み）と
   * main スレッドの `load()`（読み取り）の両方から触れるため `@Volatile`。
   */
  @Volatile
  private var isReleased = false

  // status/error/loadedSize/responseInfo は GMA のコールバック（main スレッド、Google の
  // 慣例により常にメインスレッドで呼ばれる）から書き込まれ、JS 側の Property getter
  // （JS スレッド）から読み取られる（Lesson 6: データ競合）。書き込みのたびに丸ごと新しい
  // 値を代入するだけで内部を可変更新しないので、可視性さえ保証すればよく `@Volatile` で十分。
  @Volatile
  var status: String = "loading"
    private set

  @Volatile
  var error: Map<String, Any?>? = null
    private set

  @Volatile
  var loadedSize: Map<String, Any?>? = null
    private set

  @Volatile
  var responseInfo: Map<String, Any?>? = null
    private set

  /**
   * [Lesson 1 の Android 版 — スレッドアフィニティ]
   * `AdView`（`FrameLayout` のサブクラス）の生成・`loadAd()` は UI スレッド専用の操作。
   * Looper を持たないスレッド（JS スレッドなど）で `View` を生成すると内部の `Handler`
   * 生成などでクラッシュしうる。一方 JS 側の `Function("load")` は同期関数として
   * JS スレッドから呼ばれる。`load()` は戻り値を必要としないため、JS スレッドを
   * ブロックしてまで main の完了を待つ理由が無く、非同期 post で十分
   * （iOS 最新版が `DispatchQueue.main.sync` から `DispatchQueue.main.async` に
   * 直した判断と同じ）。
   */
  fun load() {
    mainHandler.post {
      if (isReleased) {
        // release() 済み。もう表示するものが無いので何もしない。
        return@post
      }

      // [Lesson 4 の Android 版] rootViewController 相当。`appContext`（SharedObject が
      // 弱参照経由で保持する）から `currentActivity` を毎回解決し直す。init 時に一度だけ
      // 解決して固定すると、プリロード時（まだ Activity が存在しない）に失敗したまま
      // 二度と復帰できなくなる。
      val activity = appContext?.currentActivity
      if (activity == null) {
        setError(
          "表示可能な Activity が見つからないため広告をロードできませんでした。" +
            "アプリの起動が完了してから、または BannerAdView をマウントしてから " +
            "load() を呼び直してください。"
        )
        return@post
      }

      val view = adView ?: AdView(activity).also { adView = it }

      status = "loading"
      error = null
      emitStatusChange()

      val request = BannerAdRequest.Builder(adUnitId, requestedSize)
        .applyRequestOptions(requestOptions)
        .build()

      view.loadAd(
        request,
        object : AdLoadCallback<GmaBannerAd> {
          override fun onAdLoaded(ad: GmaBannerAd) {
            status = "loaded"
            val loadedAdSize = ad.getAdSize()
            loadedSize = mapOf("width" to loadedAdSize.width, "height" to loadedAdSize.height)
            responseInfo = ad.getResponseInfo().toMap()
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
            emitStatusChange()
          }

          override fun onAdFailedToLoad(adError: LoadAdError) {
            status = "error"
            error = adError.toMap()
            emitStatusChange()
          }
        }
      )
    }
  }

  private fun setError(message: String) {
    status = "error"
    error = mapOf("code" to -1, "message" to message, "domain" to "expo-google-mobile-ads")
    emitStatusChange()
  }

  private fun emitStatusChange() {
    emit("statusChange", mapOf("status" to status, "error" to error))
  }

  /**
   * [Lesson 3 の Android 版 — release は実際にテアダウンしなければならない]
   * `release()` は JS との結びつきを切るだけでネイティブ側の後始末はしてくれないため、
   * ここで View から外し、破棄する。
   *
   * [Lesson 2 の Android 版 — ロックを保持したまま別スレッドを待たない]
   * iOS では `sharedObjectWillRelease()` がレジストリの mutex を保持したまま呼ばれるため
   * `DispatchQueue.main.sync` はデッドロックしうる、という制約があった。
   * `SharedObjectRegistry.kt`（expo-modules-core Android, `delete(id)`）を実際に読んだところ、
   * `synchronized(this) { pairs.remove(id) }` という synchronized ブロックが完了して
   * ロックを解放した*後*に `.let { it.sharedObjectDidRelease() }` を呼んでおり、
   * Android では `sharedObjectDidRelease()` の実行中にレジストリのロックは保持されて
   * いない（iOS とは実装が異なる）。そのため理論上は同期的な main 待ち合わせをしても
   * iOS と同じ種類のロック逆転は起きない。とはいえ `release()` 自体は任意のスレッド
   * （典型的には JS スレッド）から同期的に呼ばれるため、わざわざそのスレッドを塞いで
   * main の完了を待つ理由が無く、iOS 版と同じく非同期 post に留めた。
   */
  override fun sharedObjectDidRelease() {
    isReleased = true
    val view = adView ?: return
    mainHandler.post {
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
  // networkExtras は意図的に未対応（JS 側の RequestOptions 型からも意図的に外されている）。
  return this
}
