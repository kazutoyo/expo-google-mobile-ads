package expo.modules.googlemobileads

import android.os.Handler
import android.os.Looper
import com.google.android.libraries.ads.mobile.sdk.MobileAds
import com.google.android.libraries.ads.mobile.sdk.banner.AdSize
import com.google.android.libraries.ads.mobile.sdk.common.RequestConfiguration
import com.google.android.libraries.ads.mobile.sdk.initialization.AdapterStatus
import com.google.android.libraries.ads.mobile.sdk.initialization.InitializationConfig
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.math.roundToInt
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext

private val mainHandler = Handler(Looper.getMainLooper())

private const val MAIN_THREAD_TIMEOUT_MS = 5_000L

/**
 * [Review fix — C1] `runOnMain` が UI スレッドから応答を得られなかったときの例外。
 * 以前は待ち合わせが無期限（`latch.await()` に引数なし）だったため、main 側の
 * Runnable が例外で終了すると `countDown()` に到達せず JS スレッドが永久に停止した。
 */
class UiThreadUnresponsiveException :
  CodedException(message = "UI スレッドが ${MAIN_THREAD_TIMEOUT_MS}ms 以内に応答しませんでした。")

/**
 * メインスレッド上ならそのまま実行し、そうでなければメインスレッドへ同期的にホップしてから
 * 実行する（iOS 版 `runOnMain`（`DispatchQueue.main.sync`）の Android 版）。
 *
 * [Lesson 1 の Android 版] `AdSize` のアダプティブサイズ計算関数（`getAnchoredAdaptiveSize` 等）
 * は JS API 上あえて同期関数にしている（呼び出し側がロード前にレイアウトを確定させるため）ため
 * 非同期化できない。GMA Android のドキュメントは iOS の `GADAdSize.h` ほど明示的に
 * メインスレッド専用とは書いていないが、これらは画面サイズ・向きを読む処理であり、
 * UI 関連の状態を UI スレッド以外から読むのは一般的な Android の作法に反するため、
 * 安全側に倒して明示的にメインスレッドへホップする。
 *
 * [Review fix — C1, レビュー指摘を受けて全面的に書き直し]
 * 以前の実装には3つの実バグがあった:
 *   (a) 投げられた例外を捕まえておらず、`countDown()` が `finally` の外にあったため、
 *       main 側の Runnable が例外を投げると `countDown()` に到達せず JS スレッドが
 *       **確定的に**無期限ハングする（`Exceptions.MissingActivity()` を投げるプリロード時の
 *       経路が、この不具合をまさにこのライブラリの主要ユースケースで踏む）。
 *   (b) `latch.await()` にタイムアウトが無く、ハングは即 ANR（回復不能）だった。
 *   (c) React Native の New Architecture には UI スレッドが JS ランタイムの完了を
 *       同期的に待つ経路が存在する
 *       （`AndroidEventBeat::tick` → `induce()` →
 *       `executeSynchronouslyOnSameThread_CAN_DEADLOCK`、`EventBeat.h:99` の
 *       "Both JS and UI thread are blocked" というコメントが示す通り）。
 *       これは「ロックを保持しているか」の話ではなく、**JS ランタイムそのものが
 *       競合資源になり得る**という話であり、以前のコメントが「registry のロックを
 *       保持したまま呼ばれることはないので安全」としていたのは誤った論拠だった。
 *       iOS 側もまさにこの理由で `main.sync` の使用箇所を絞り込んだ経緯がある。
 *
 * 対応: (a)(b) は `try/finally` + タイムアウト付き `await` で解消した — 例外は
 * `error` に捕まえて JS スレッド側で re-throw し、`countDown()` は必ず `finally` で
 * 呼ばれる。タイムアウトした場合は無期限ハングではなく `UiThreadUnresponsiveException`
 * という回復可能なエラーになる。(c) は本質的には解消していない —
 * この3つの同期関数を「JS 側の同期 API 契約」として残す限り、UI スレッドが
 * 塞がっている間の同期呼び出しには理論上のリスクが残る。iOS も同じ理由でこの種の
 * 呼び出しパターン自体は残しており（`sharedObjectWillRelease` のような「レジストリの
 * ロックを保持したまま呼ばれる」経路からは撤去したが、これらのサイズ計算関数からは
 * 撤去していない）、ここでも同じ判断に倣った。つまり (c) は「起きなくなった」の
 * ではなく「境界を持つ回復可能なエラーに変えた」ことで許容範囲に収めている。
 */
private fun <T> runOnMain(block: () -> T): T {
  if (Looper.myLooper() == Looper.getMainLooper()) {
    return block()
  }
  val latch = CountDownLatch(1)
  var result: T? = null
  var error: Throwable? = null
  mainHandler.post {
    try {
      result = block()
    } catch (t: Throwable) {
      error = t
    } finally {
      latch.countDown()
    }
  }
  if (!latch.await(MAIN_THREAD_TIMEOUT_MS, TimeUnit.MILLISECONDS)) {
    throw UiThreadUnresponsiveException()
  }
  error?.let { throw it }
  @Suppress("UNCHECKED_CAST")
  return result as T
}

private fun Map<String, Any?>.toRequestConfiguration(): RequestConfiguration {
  val builder = RequestConfiguration.Builder()

  (this["testDeviceIds"] as? List<*>)?.let { ids ->
    builder.setTestDeviceIds(ids.filterIsInstance<String>())
  }
  (this["tagForChildDirectedTreatment"] as? Boolean)?.let { childDirected ->
    builder.setTagForChildDirectedTreatment(
      if (childDirected) {
        RequestConfiguration.TagForChildDirectedTreatment.TAG_FOR_CHILD_DIRECTED_TREATMENT_TRUE
      } else {
        RequestConfiguration.TagForChildDirectedTreatment.TAG_FOR_CHILD_DIRECTED_TREATMENT_FALSE
      }
    )
  }
  (this["tagForUnderAgeOfConsent"] as? Boolean)?.let { underAge ->
    builder.setTagForUnderAgeOfConsent(
      if (underAge) {
        RequestConfiguration.TagForUnderAgeOfConsent.TAG_FOR_UNDER_AGE_OF_CONSENT_TRUE
      } else {
        RequestConfiguration.TagForUnderAgeOfConsent.TAG_FOR_UNDER_AGE_OF_CONSENT_FALSE
      }
    )
  }
  (this["maxAdContentRating"] as? String)?.let { rating ->
    val maxAdContentRating = when (rating) {
      "G" -> RequestConfiguration.MaxAdContentRating.MAX_AD_CONTENT_RATING_G
      "PG" -> RequestConfiguration.MaxAdContentRating.MAX_AD_CONTENT_RATING_PG
      "T" -> RequestConfiguration.MaxAdContentRating.MAX_AD_CONTENT_RATING_T
      "MA" -> RequestConfiguration.MaxAdContentRating.MAX_AD_CONTENT_RATING_MA
      else -> RequestConfiguration.MaxAdContentRating.MAX_AD_CONTENT_RATING_UNSPECIFIED
    }
    builder.setMaxAdContentRating(maxAdContentRating)
  }

  return builder.build()
}

private fun AdSize.toMap(): Map<String, Any?> = mapOf("width" to width, "height" to height)

class ExpoGoogleMobileAdsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoGoogleMobileAds")

    AsyncFunction("initializeAsync") Coroutine { ->
      // [Lesson 1 の Android 版 — 逆向きのケース] `MobileAds.initialize()` はネットワーク越しの
      // アダプター初期化を含む重い処理であり、メインスレッドで呼ぶと ANR の恐れがある。
      // iOS の `MobileAds.shared.start()` が明示的に main へ寄せる（軽い処理なので）のとは
      // 逆に、Android 側はここを明示的にバックグラウンド（IO）スレッドへ逃がす。
      withContext(Dispatchers.IO) {
        val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
        val appId = AppIdProvider.get(context)
        suspendCancellableCoroutine { continuation ->
          MobileAds.initialize(
            context,
            InitializationConfig.Builder(appId).build()
          ) { status ->
            val adapterStatuses = status.adapterStatusMap.mapValues { (_, adapterStatus) ->
              mapOf(
                // 実際の `AdapterStatus.InitializationState` には NOT_STARTED / INITIALIZING /
                // COMPLETE / TIMED_OUT / FAILED しか無く、brief が仮定していた READY という
                // 値は存在しない。「ready」に対応するのは COMPLETE のみ。
                "state" to if (adapterStatus.initializationState ==
                  AdapterStatus.InitializationState.COMPLETE
                ) {
                  "ready"
                } else {
                  "notReady"
                },
                "description" to adapterStatus.description,
                // AdapterStatus.getLatency() は Android では既にミリ秒単位の Int で
                // 公開されているため、iOS のような *1000 の変換は不要。
                "latency" to adapterStatus.latency
              )
            }
            continuation.resume(mapOf("adapterStatuses" to adapterStatuses))
          }
        }
      }
    }

    // [Review fix — I2] 以前は main へ post していたが、`initializeAsync` は
    // `Dispatchers.IO`（別スレッド）で `MobileAds.initialize()` を呼ぶため、
    // 「main への post」と「IO への dispatch」という無関係な2つのキュー間には
    // 順序保証が無く、JS 側が `setRequestConfiguration()` → `initialize()` の順に
    // 呼んでも `testDeviceIds` の設定が初期化より後に反映される競合がありえた
    // （iOS の「呼び出しは同じ main キューで FIFO 順に実行される」という前提は
    // Android のこの構成には当てはまらない）。この関数はメインスレッド専用という
    // ドキュメント上の制約が無い単純な static setter なので、わざわざ別キューへ
    // 逃がす意味も無い。JS スレッド上で同期的に呼ぶことで、JS 側が呼んだ順序が
    // そのまま実行順序になることを保証する。
    Function("setRequestConfiguration") { config: Map<String, Any?> ->
      MobileAds.setRequestConfiguration(config.toRequestConfiguration())
    }

    // [Review fix — M1] 以前は `appContext.currentActivity` を要求し、無ければ
    // `Exceptions.MissingActivity()` を投げていた。しかし JS 側の同じ関数は iOS では
    // 失敗し得ない契約になっており、同じ JS 呼び出しがプラットフォームによって
    // 例外を投げたり投げなかったりするのは契約として破綻している。
    // 実際には `AdSize` のこれらの静的関数はいずれも `Activity` ではなく汎用の
    // `Context` しか要求しない（javap で確認済み）ため、`appContext.currentActivity`
    // ではなく `appContext.reactContext` を使うのが正しい修正。`reactContext` は
    // JS からこの関数を呼べている時点で（React インスタンスが存在する時点で）
    // 実質的に必ず存在するため、iOS の「失敗しない」契約に実質的に一致する。
    Function("getAnchoredAdaptiveSize") { width: Double, orientation: String ->
      runOnMain {
        val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
        val widthPx = width.roundToInt()
        when (orientation) {
          "portrait" -> AdSize.getPortraitAnchoredAdaptiveBannerAdSize(context, widthPx)
          "landscape" -> AdSize.getLandscapeAnchoredAdaptiveBannerAdSize(context, widthPx)
          else -> AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(context, widthPx)
        }.toMap()
      }
    }

    Function("getLargeAnchoredAdaptiveSize") { width: Double, orientation: String ->
      runOnMain {
        val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
        val widthPx = width.roundToInt()
        when (orientation) {
          "portrait" -> AdSize.getLargePortraitAnchoredAdaptiveBannerAdSize(context, widthPx)
          "landscape" -> AdSize.getLargeLandscapeAnchoredAdaptiveBannerAdSize(context, widthPx)
          else -> AdSize.getLargeAnchoredAdaptiveBannerAdSize(context, widthPx)
        }.toMap()
      }
    }

    Function("getInlineAdaptiveSize") { width: Double, maxHeight: Double?, orientation: String ->
      runOnMain {
        val widthPx = width.roundToInt()
        if (maxHeight != null) {
          // getInlineAdaptiveBannerAdSize(width, maxHeight) は Context を要求しない静的計算。
          AdSize.getInlineAdaptiveBannerAdSize(widthPx, maxHeight.roundToInt())
        } else {
          val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
          when (orientation) {
            "portrait" -> AdSize.getPortraitInlineAdaptiveBannerAdSize(context, widthPx)
            "landscape" -> AdSize.getLandscapeInlineAdaptiveBannerAdSize(context, widthPx)
            else -> AdSize.getCurrentOrientationInlineAdaptiveBannerAdSize(context, widthPx)
          }
        }.toMap()
      }
    }

    Class(BannerAd::class) {
      Constructor { adUnitId: String, size: Map<String, Any?>, requestOptions: Map<String, Any?>? ->
        val width = (size["width"] as? Number)?.toInt() ?: throw InvalidBannerSizeException()
        val height = (size["height"] as? Number)?.toInt() ?: throw InvalidBannerSizeException()
        // [Lesson 4 の Android 版] ここでは Activity を解決・要求しない。プリロード時点
        // （まだ Activity が存在しない）でも Constructor は成功しなければならない。
        // Activity の解決は BannerAd.load()/ensureAdView() のたびに行う。
        BannerAd(appContext, adUnitId, AdSize(width, height), requestOptions)
      }

      Property("size") { ad: BannerAd -> ad.requestedSizeMap }
      Property("status") { ad: BannerAd -> ad.status }
      Property("error") { ad: BannerAd -> ad.error }
      Property("loadedSize") { ad: BannerAd -> ad.loadedSize }
      Property("responseInfo") { ad: BannerAd -> ad.responseInfo }

      Function("load") { ad: BannerAd -> ad.load() }

      Events("statusChange", "impression", "clicked", "paid")
    }

    View(BannerAdView::class) {
      Prop("ad") { view: BannerAdView, ad: BannerAd? ->
        view.setAd(ad)
      }
    }
  }
}
