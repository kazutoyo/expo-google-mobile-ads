import ExpoModulesCore
import GoogleMobileAds

public final class ExpoGoogleMobileAdsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoGoogleMobileAds")

    AsyncFunction("initializeAsync") { () async -> [String: Any] in
      let status = await MobileAds.shared.start()
      let adapterStatuses = status.adapterStatusesByClassName.mapValues { value in
        [
          "state": value.state == .ready ? "ready" : "notReady",
          "description": value.description,
          "latency": Int(value.latency * 1000),
        ]
      }
      return ["adapterStatuses": adapterStatuses]
    }

    Function("setRequestConfiguration") { (config: [String: Any?]) in
      let requestConfiguration = MobileAds.shared.requestConfiguration
      if let testDeviceIds = config["testDeviceIds"] as? [String] {
        requestConfiguration.testDeviceIdentifiers = testDeviceIds
      }
      if let childDirected = config["tagForChildDirectedTreatment"] as? Bool {
        requestConfiguration.tagForChildDirectedTreatment = NSNumber(value: childDirected)
      }
      if let underAge = config["tagForUnderAgeOfConsent"] as? Bool {
        requestConfiguration.tagForUnderAgeOfConsent = NSNumber(value: underAge)
      }
      if let rating = config["maxAdContentRating"] as? String {
        // Swift 側の型名は `GADMaxAdContentRating`（NS_TYPED_ENUM の typedef 自体に
        // NS_SWIFT_NAME が付いていないため GAD プレフィックスが落ちない）。
        requestConfiguration.maxAdContentRating = GADMaxAdContentRating(rawValue: rating)
      }
    }

    // これら 3 つのサイズ計算関数は JS API 上あえて同期関数にしている（呼び出し側がレイアウトを
    // 広告ロード前にインラインで確定させ、後からのレイアウトシフトを避けるため）。一方
    // `GADAdSize.h` はこれらの多くを "must be called on the main queue" と明記しているため、
    // 同期のまま `runOnMain` でメインスレッドへホップする。
    Function("getAnchoredAdaptiveSize") { (width: Double, orientation: String) -> [String: Any] in
      runOnMain {
        let adSize: AdSize
        switch orientation {
        case "portrait": adSize = portraitAnchoredAdaptiveBanner(width: width)
        case "landscape": adSize = landscapeAnchoredAdaptiveBanner(width: width)
        default: adSize = currentOrientationAnchoredAdaptiveBanner(width: width)
        }
        return ["width": adSize.size.width, "height": adSize.size.height]
      }
    }

    Function("getLargeAnchoredAdaptiveSize") { (width: Double, orientation: String) -> [String: Any] in
      runOnMain {
        let adSize: AdSize
        switch orientation {
        case "portrait": adSize = largePortraitAnchoredAdaptiveBanner(width: width)
        case "landscape": adSize = largeLandscapeAnchoredAdaptiveBanner(width: width)
        default: adSize = largeAnchoredAdaptiveBanner(width: width)
        }
        return ["width": adSize.size.width, "height": adSize.size.height]
      }
    }

    Function("getInlineAdaptiveSize") { (width: Double, maxHeight: Double?, orientation: String) -> [String: Any] in
      runOnMain {
        let adSize: AdSize
        if let maxHeight {
          adSize = inlineAdaptiveBanner(width: width, maxHeight: maxHeight)
        } else {
          switch orientation {
          case "portrait": adSize = portraitInlineAdaptiveBanner(width: width)
          case "landscape": adSize = landscapeInlineAdaptiveBanner(width: width)
          default: adSize = currentOrientationInlineAdaptiveBanner(width: width)
          }
        }
        return ["width": adSize.size.width, "height": adSize.size.height]
      }
    }

    Class(BannerAd.self) {
      Constructor { (adUnitId: String, size: [String: Any?], requestOptions: [String: Any?]?) throws -> BannerAd in
        try BannerAd(adUnitId: adUnitId, size: size, requestOptions: requestOptions)
      }

      Property("size") { (ad: BannerAd) in ad.requestedSize }
      // status/error/loadedSize/responseInfo は BannerViewDelegate のコールバック（メイン
      // スレッド）から書き込まれる。Swift の Dictionary はスレッドセーフではないため、JS 側
      // からの読み取りも runOnMain でメインスレッドへ同期し、書き込みと直列化する。
      Property("status") { (ad: BannerAd) in runOnMain { ad.status } }
      Property("error") { (ad: BannerAd) in runOnMain { ad.error } }
      Property("loadedSize") { (ad: BannerAd) in runOnMain { ad.loadedSize } }
      Property("responseInfo") { (ad: BannerAd) in runOnMain { ad.responseInfo } }

      Function("load") { (ad: BannerAd) in ad.load() }

      // 注意: この expo-modules-core バージョンでは `EventsDefinition` が
      // `ClassDefinitionElement` に適合しておらず、`Class(...)` 内で `Events(...)` は使えない
      // （`View(...)` 内でのみ有効）。SharedObject の `emit(event:payload:)` はイベント名の
      // 事前登録を必要としないため、JS 側の `addListener("statusChange" | "impression" |
      // "clicked" | "paid", ...)` はこのままで問題なく動作する。
    }

    View(BannerAdView.self) {
      Prop("ad") { (view: BannerAdView, ad: BannerAd?) in
        view.setAd(ad)
      }
    }
  }
}
