import ExpoModulesCore
import GoogleMobileAds

/// `MobileAds.shared.start()` を明示的にメインスレッド（`@MainActor`）で呼ぶ。GMA のヘッダーは
/// このメソッドをメインスレッド専用とは明記していないが、GMA は慣習的にメインスレッドから
/// 初期化するものとされており、確実にするコストは async 関数の中での 1 回のホップだけなので
/// 迷わず main に寄せる。`initializeAsync` は元々 `AsyncFunction`（async）なので、この
/// アクターホップは実質コスト無し。
@MainActor
private func startMobileAdsSDK() async -> InitializationStatus {
  await MobileAds.shared.start()
}

public final class ExpoGoogleMobileAdsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoGoogleMobileAds")

    AsyncFunction("initializeAsync") { () async -> [String: Any] in
      let status = await startMobileAdsSDK()
      let adapterStatuses = status.adapterStatusesByClassName.mapValues { value in
        [
          "state": value.state == .ready ? "ready" : "notReady",
          "description": value.description,
          "latency": Int(value.latency * 1000),
        ]
      }
      return ["adapterStatuses": adapterStatuses]
    }

    // 戻り値の無い同期 `Function` なので、呼び出しスレッド（JS スレッド）を塞いで main の完了を
    // 待つ理由が無い。`load()` と同じく `DispatchQueue.main.async` に投げるだけにしてある
    // （同期の Function 本体は JS ランタイムを保持したまま走るため、そこからの `main.sync` は
    // 原理的にデッドロックし得る。詳細は BannerAd.swift の `runOnMain` のコメントを参照）。
    // main へ寄せる理由は GMA がメインスレッド初期化を慣習としているため。
    //
    // **順序について**: GMA は `requestConfiguration`（特に `testDeviceIdentifiers`）を
    // `start()` より前に設定することを期待する。非同期化してもこれは崩れない。JS が
    // setRequestConfiguration → initializeAsync の順に呼ぶ限り、両者の「メインキューへの
    // 積み込み時点」が次の順に並ぶため:
    //   E: 下の `DispatchQueue.main.async` — JS の同期呼び出しの最中に積まれ、
    //      `setRequestConfiguration` が JS へ返る時点でメインキューに載っている。
    //   M: `initializeAsync` → `await startMobileAdsSDK()`（`@MainActor`）のアクターホップ。
    //      これは `initializeAsync` の本体が走り始めて await に到達して初めて積まれるので、
    //      どんなに早くても JS が `initializeAsync` を呼んだ後 ——つまり E より必ず後になる。
    // メインキューは FIFO なので E → M の順に実行され、`start()` は設定済みの状態で走る。
    // この論証は「`initializeAsync` の本体がどのキューで走るか」に依存しない（本体が仮に
    // main 上で走ったとしても、その実行自体が E より後に積まれたブロックになるだけ）。
    // 依存しているのは「`@MainActor` の既定 executor がメインキューへ積む」という
    // Swift ランタイムの実装挙動 1 点だけで、これはソースまでは追っていない。
    // 逆に、JS 側が順序を守らなければ（先に initializeAsync を呼ぶ等）保証は無い。これは
    // ネイティブ側では閉じられない、GMA 共通の呼び出し規約。
    Function("setRequestConfiguration") { (config: [String: Any?]) in
      DispatchQueue.main.async {
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
    }

    // これら 3 つのサイズ計算関数は JS API 上あえて同期関数にしている（呼び出し側がレイアウトを
    // 広告ロード前にインラインで確定させ、後からのレイアウトシフトを避けるため）。一方
    // `GADAdSize.h` はこれらの多くを "must be called on the main queue" と明記しているため、
    // 同期のまま `runOnMain` でメインスレッドへホップする以外に手が無い。
    // このモジュールで意図的に `main.sync` に到達しうるのはこの 3 箇所だけ。残存リスク
    // （main がその瞬間に JS ランタイムを同期的に待っていればデッドロックし得る）は
    // BannerAd.swift の `runOnMain` のコメントに書いたとおりで、短く・数値計算だけで・
    // JS に再入しないことを理由に受け入れている。
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
      // スレッド）から書き込まれ、React の render のたびに JS 側から読み取られる（ホット
      // パス）。以前はここも runOnMain（＝main.sync）でメインスレッドへ同期させていたが、
      // main が JS ランタイムへ同期的に割り込む経路と衝突しうる上に、頻繁に呼ばれる箇所を
      // メインスレッドの詰まり具合に晒すことになるため、BannerAd 内部の NSLock に置き換えた
      // （詳細は BannerAd.swift 側のコメントを参照）。ここではもう main には触れていない。
      Property("status") { (ad: BannerAd) in ad.status }
      Property("error") { (ad: BannerAd) in ad.error }
      Property("loadedSize") { (ad: BannerAd) in ad.loadedSize }
      Property("responseInfo") { (ad: BannerAd) in ad.responseInfo }

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
