package expo.modules.googlemobileads

import android.os.Handler
import android.os.Looper
import android.view.ViewGroup
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

/**
 * `size` に数値の width/height が含まれていない場合のエラー。iOS 版の
 * `InvalidBannerSizeException` と同じ考え方: 設定ミスを `?: 0` で 0x0 のバナーへ静かに
 * 縮退させず、呼び出し側に例外として伝える。
 */
class InvalidBannerSizeException :
  CodedException(message = "BannerAd の size には数値の width と height が必要です")

/**
 * [Review fix 1 — I4] `status`/`error`/`loadedSize`/`responseInfo` を1つの不変スナップショット
 * にまとめ、単一の `@Volatile` 参照で公開する。個別に `@Volatile` を付けるだけでは
 * 「フィールドごとの可視性」は保証されても「複数フィールドの組」の一貫性は保証されない
 * （例: JS 側が `status`/`error` を1レンダー内で読むと、書き込みの途中状態
 * `{status: "error", error: null}` を観測しうる）。丸ごと新しいインスタンスに
 * 差し替えることで、読み取り側は常にどれか1つの一貫したスナップショットだけを見る。
 */
private data class LoadState(
  val status: String,
  val error: Map<String, Any?>?,
  val loadedSize: Map<String, Any?>?,
  val responseInfo: Map<String, Any?>?
)

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

  // [Review fix — I4] 4フィールドをまとめた LoadState を単一の @Volatile 参照で公開する。
  // GMA のコールバック（main スレッド）から書き込まれ、JS 側の Property getter
  // （JS スレッド）から読み取られる（Lesson 6: データ競合）。
  @Volatile
  private var state = LoadState(status = "loading", error = null, loadedSize = null, responseInfo = null)

  val status: String get() = state.status
  val error: Map<String, Any?>? get() = state.error
  val loadedSize: Map<String, Any?>? get() = state.loadedSize
  val responseInfo: Map<String, Any?>? get() = state.responseInfo

  /**
   * [Review fix — I1] `load()` を待たずに `BannerAdView` が先にマウントされた場合でも、
   * その時点で Activity が解決できるなら `AdView` を作る（iOS が `setAd` 内で遅延生成する
   * のと同じ設計）。`load()` と `BannerAdView.setAd()` の両方から呼ばれるが、どちらも
   * 呼び出しは常に UI スレッド上（`load()` は main に post 済み、`setAd` は Fabric の
   * prop 適用で常に UI スレッド）なので、生成自体に追加の同期は不要。
   *
   * `BannerAdView` は React Native の実 View としてしか存在し得ず、mount される時点で
   * 必ずそれをホストする Activity が既に存在する（そうでなければ描画先の window が無い）。
   * そのため実際には `setAd()` からの呼び出しで Activity が取れないケースはほぼ起こらない
   * — 起こり得るのは「プリロードしたが `load()` がまだ main の Runnable を消化していない」
   * ようなごく短い窓のみで、`setAd` 側の呼び出しがそれも埋める。
   */
  internal fun ensureAdView(): AdView? {
    if (isReleased) return null
    adView?.let { return it }
    val activity = appContext?.currentActivity ?: return null
    return AdView(activity).also { adView = it }
  }

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

      // [Lesson 4 の Android 版] rootViewController 相当。ensureAdView() が
      // `appContext?.currentActivity` を毎回解決し直すので、init 時に固定した Activity が
      // プリロード時に存在しないまま二度と復帰できなくなる、ということが起きない。
      val view = ensureAdView()
      if (view == null) {
        setError(
          "表示可能な Activity が見つからないため広告をロードできませんでした。" +
            "アプリの起動が完了してから、または BannerAdView をマウントしてから " +
            "load() を呼び直してください。"
        )
        return@post
      }

      state = state.copy(status = "loading", error = null)
      emitStatusChange()

      val request = BannerAdRequest.Builder(adUnitId, requestedSize)
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

  /**
   * [Review fix — C2] 初回ロード成功時と自動更新（refresh）成功時の共通処理。
   * Next-Gen SDK の自動更新は「同じ `GmaBannerAd` インスタンスを更新する」のではなく
   * 「新しい `GmaBannerAd` インスタンスに差し替える」ため、`adEventCallback` と
   * `bannerAdRefreshCallback` は都度その新しいインスタンスへ再バインドしないと、
   * 1回目の refresh 以降 impression/clicked/paid が二度と飛ばなくなり、
   * 2回目以降の refresh 通知も受け取れなくなる（`onAdRefreshed()` はコールバック引数を
   * 持たないため、最新のインスタンスは `AdView.getBannerAd()` から取り直す）。
   */
  private fun onAdReady(ad: GmaBannerAd) {
    val size = ad.getAdSize()
    state = state.copy(
      status = "loaded",
      error = null,
      loadedSize = mapOf("width" to size.width, "height" to size.height),
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
        val refreshed = adView?.getBannerAd()
        if (refreshed != null) {
          onAdReady(refreshed)
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

  private fun setError(message: String) {
    // [Review fix — Minor] iOS 側と表記を揃える（"expo-google-mobile-ads" ではなく
    // iOS の resolveRootViewController() 失敗時と同じ "ExpoGoogleMobileAds"）。
    state = state.copy(status = "error", error = mapOf("code" to -1, "message" to message, "domain" to "ExpoGoogleMobileAds"))
    emitStatusChange()
  }

  private fun emitStatusChange() {
    val snapshot = state
    emit("statusChange", mapOf("status" to snapshot.status, "error" to snapshot.error))
  }

  /**
   * [Lesson 3 の Android 版 — release は実際にテアダウンしなければならない]
   * `release()` は JS との結びつきを切るだけでネイティブ側の後始末はしてくれないため、
   * ここで View から外し、破棄する。[Review fix — Minor] 併せて `adEventCallback` と
   * `currentAttachment` もクリアする（`AdView` 自体は破棄されるので実害は小さいが、
   * 破棄後のコールバック参照や所有権情報を残さない）。
   *
   * [Lesson 2 の Android 版 — ロックを保持したまま別スレッドを待たない]
   * iOS では `sharedObjectWillRelease()` がレジストリの mutex を保持したまま呼ばれるため
   * `DispatchQueue.main.sync` はデッドロックしうる、という制約があった。
   * `SharedObjectRegistry.kt`（expo-modules-core Android, `delete(id)`）を実際に読んだところ、
   * `synchronized(this) { pairs.remove(id) }` という synchronized ブロックが完了して
   * ロックを解放した*後*に `.let { it.sharedObjectDidRelease() }` を呼んでおり、
   * Android では `sharedObjectDidRelease()` の実行中にレジストリのロックは保持されて
   * いない（iOS とは実装が異なる）。とはいえ `release()` 自体は任意のスレッド
   * （典型的には JS スレッド）から同期的に呼ばれるため、わざわざそのスレッドを塞いで
   * main の完了を待つ理由が無く、iOS 版と同じく非同期 post に留めた。
   */
  override fun sharedObjectDidRelease() {
    isReleased = true
    currentAttachment = null
    val view = adView ?: return
    mainHandler.post {
      view.getBannerAd()?.adEventCallback = null
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
