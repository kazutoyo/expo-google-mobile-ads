package expo.modules.googlemobileads

import android.os.Handler
import android.os.Looper
import com.google.android.libraries.ads.mobile.sdk.MobileAds
import com.google.android.libraries.ads.mobile.sdk.banner.AdSize
import com.google.android.libraries.ads.mobile.sdk.common.RequestConfiguration
import com.google.android.libraries.ads.mobile.sdk.initialization.AdapterStatus
import com.google.android.libraries.ads.mobile.sdk.initialization.InitializationConfig
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.CountDownLatch
import kotlin.coroutines.resume
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext

private val mainHandler = Handler(Looper.getMainLooper())

/**
 * メインスレッド上ならそのまま実行し、そうでなければメインスレッドへ同期的にホップしてから
 * 実行する（iOS 版 `runOnMain`（`DispatchQueue.main.sync`）の Android 版）。
 *
 * [Lesson 1 の Android 版] `AdSize` のアダプティブサイズ計算関数（`getAnchoredAdaptiveSize` 等）
 * は JS API 上あえて同期関数にしている（呼び出し側がロード前にレイアウトを確定させるため）ため
 * 非同期化できない。GMA Android のドキュメントは iOS の `GADAdSize.h` ほど明示的に
 * メインスレッド専用とは書いていないが、これらは Activity の画面サイズ・向きを読む処理であり、
 * UI 関連の状態を UI スレッド以外から読むのは一般的な Android の作法に反するため、
 * 安全側に倒して明示的にメインスレッドへホップする。
 *
 * このモジュール関数（`Function`）は `SharedObject` に紐づかないため、Android の
 * `SharedObjectRegistry.delete()` のようにロックを保持したまま呼ばれることはなく、
 * 同期的な `main` 待ち合わせをしてもデッドロックの心配は無い。
 */
private fun <T> runOnMain(block: () -> T): T {
  if (Looper.myLooper() == Looper.getMainLooper()) {
    return block()
  }
  var result: T? = null
  val latch = CountDownLatch(1)
  mainHandler.post {
    result = block()
    latch.countDown()
  }
  latch.await()
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

    // SharedObject に紐づかないモジュール関数なので、registry のロックを保持したまま
    // 呼ばれることはない。setRequestConfiguration 自体は戻り値の無い void 関数なので、
    // わざわざ呼び出し元スレッドを塞いで main の完了を待つ必要は無く、非同期 post で十分。
    Function("setRequestConfiguration") { config: Map<String, Any?> ->
      val requestConfiguration = config.toRequestConfiguration()
      mainHandler.post {
        MobileAds.setRequestConfiguration(requestConfiguration)
      }
    }

    Function("getAnchoredAdaptiveSize") { width: Int, orientation: String ->
      runOnMain {
        val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()
        when (orientation) {
          "portrait" -> AdSize.getPortraitAnchoredAdaptiveBannerAdSize(activity, width)
          "landscape" -> AdSize.getLandscapeAnchoredAdaptiveBannerAdSize(activity, width)
          else -> AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(activity, width)
        }.toMap()
      }
    }

    Function("getLargeAnchoredAdaptiveSize") { width: Int, orientation: String ->
      runOnMain {
        val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()
        when (orientation) {
          "portrait" -> AdSize.getLargePortraitAnchoredAdaptiveBannerAdSize(activity, width)
          "landscape" -> AdSize.getLargeLandscapeAnchoredAdaptiveBannerAdSize(activity, width)
          else -> AdSize.getLargeAnchoredAdaptiveBannerAdSize(activity, width)
        }.toMap()
      }
    }

    Function("getInlineAdaptiveSize") { width: Int, maxHeight: Int?, orientation: String ->
      runOnMain {
        if (maxHeight != null) {
          // getInlineAdaptiveBannerAdSize(width, maxHeight) は Context を要求しない静的計算。
          AdSize.getInlineAdaptiveBannerAdSize(width, maxHeight)
        } else {
          val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()
          when (orientation) {
            "portrait" -> AdSize.getPortraitInlineAdaptiveBannerAdSize(activity, width)
            "landscape" -> AdSize.getLandscapeInlineAdaptiveBannerAdSize(activity, width)
            else -> AdSize.getCurrentOrientationInlineAdaptiveBannerAdSize(activity, width)
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
        // Activity の解決は BannerAd.load() のたびに行う。
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
