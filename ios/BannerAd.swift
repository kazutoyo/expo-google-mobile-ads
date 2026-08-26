import ExpoModulesCore
import GoogleMobileAds
import UIKit

/// メインスレッド上ならそのまま実行し、そうでなければ `DispatchQueue.main.sync` で
/// メインスレッドへ同期的にホップしてから実行する。
///
/// UIKit と GoogleMobileAds のほとんどの API はメインスレッド専用（`GADAdSize.h` の
/// アダプティブサイズ関数群には "This function must be called on the main queue." と明記
/// されている）。一方、Expo Modules の `Constructor` / `Function` / `Property` はどのスレッドで
/// 呼ばれるか保証されない（`AsyncFunction` の既定キューもメインではない）ため、UIKit/GMA に
/// 触れる箇所はすべてこの関数でメインスレッドへ同期させる。
///
/// デッドロックについて: `Thread.isMainThread` の早期リターンにより、既にメインスレッドから
/// 呼ばれた場合の自己デッドロック（再入）は起きない。残るリスクは「メインスレッドが、この
/// 関数の呼び出し元スレッドを同期的に待っている」という逆方向の依存が同時に存在する場合だが、
/// このモジュール内にそのようなコードパスは無い（メインスレッドから JS スレッドを同期的に
/// 待つ処理は存在しない）。したがって現状で現実的なデッドロック経路は無いと判断した。
func runOnMain<T>(_ block: () -> T) -> T {
  if Thread.isMainThread {
    return block()
  }
  return DispatchQueue.main.sync(execute: block)
}

/// `size` に数値の `width`/`height` が含まれていない場合のエラー。
/// 以前は `?? 0` で 0×0 のバナーへ静かに縮退していたが、設定ミスは呼び出し側に
/// 例外として伝えるべき（0×0 は原因の分からない「広告が表示されない」バグにしかならない）。
final class InvalidBannerSizeException: Exception, @unchecked Sendable {
  override var reason: String {
    "BannerAd の size には数値の width と height が必要です"
  }
}

/// ビュー階層に入れずに保持・ロードできる広告インスタンス。
/// `BannerAdView` がマウント時に `bannerView` を addSubview し、アンマウント時は
/// removeFromSuperview するだけ — 破棄はしない。これにより画面遷移をまたいで再利用できる。
///
/// `SharedObject`（expo-modules-core）は `NSObject` を継承しない Swift クラスであるため、
/// `NSObjectProtocol` を要求する ObjC プロトコルの `BannerViewDelegate` に直接は適合できない
/// （`cannot declare conformance to 'NSObjectProtocol' in Swift` でビルドエラーになる）。
/// そのため NSObject ベースの小さなプロキシ `BannerAdDelegateProxy` 経由でイベントを受け取る。
final class BannerAd: SharedObject {
  private var _bannerView: BannerView?

  /// ビュー階層に入れずに保持する。表示時に BannerAdView が addSubview する。
  ///
  /// 遅延生成にしているのは、`GADBannerView` の生成・設定がメインスレッド専用の UIKit/GMA API
  /// である一方、`Constructor` は JS へ同期的にオブジェクトを返す必要があり、初期化の中で
  /// メインスレッドへ同期ホップするのは（JS スレッド=メインスレッドの環境やテスト環境も
  /// 含めて）避けたいため。実際に必要になる `load()` / `BannerAdView` アタッチ時まで生成を遅らせる。
  var bannerView: BannerView {
    runOnMain {
      if let existing = _bannerView {
        return existing
      }
      let view = BannerView(adSize: adSizeFor(cgSize: CGSize(width: adWidth, height: adHeight)))
      view.adUnitID = adUnitId
      view.delegate = delegateProxy
      // GMA では課金イベントはデリゲートではなくクロージャで通知される。
      view.paidEventHandler = { [weak self] value in
        self?.emit(event: "paid", payload: [
          "value": value.value.doubleValue,
          "currencyCode": value.currencyCode,
          "precision": adValuePrecisionToString(value.precision),
        ])
      }
      _bannerView = view
      return view
    }
  }

  /// 現在この広告を表示している BannerAdView。所有権の判定に使う（weak なので
  /// View が解放されれば自動的に nil になる）。
  weak var currentAttachment: BannerAdView?

  /// リクエストしたサイズ。JS 側の `ad.size` になる。
  let requestedSize: [String: Any?]

  private let adUnitId: String
  private let adWidth: Double
  private let adHeight: Double
  private let requestOptions: [String: Any?]?
  private let delegateProxy = BannerAdDelegateProxy()

  private(set) var status: String = "loading"
  private(set) var error: [String: Any?]?
  private(set) var loadedSize: [String: Any?]?
  private(set) var responseInfo: [String: Any?]?

  init(adUnitId: String, size: [String: Any?], requestOptions: [String: Any?]?) throws {
    guard let width = size["width"] as? Double, let height = size["height"] as? Double else {
      throw InvalidBannerSizeException()
    }
    self.adWidth = width
    self.adHeight = height
    self.requestedSize = size
    self.adUnitId = adUnitId
    self.requestOptions = requestOptions
    super.init()
    delegateProxy.owner = self
  }

  func load() {
    runOnMain {
      status = "loading"
      error = nil
      emitStatusChange()

      let view = bannerView
      // rootViewController は weak かつ「表示中の最前面 view controller」なので、init 時点で
      // 一度だけ解決して固定するとプリロード時（まだ view controller が存在しない）に nil の
      // ままになったり、後からモーダルが閉じて無効化されたりする。load() のたびに解決し直す。
      guard let rootViewController = resolveRootViewController() else {
        status = "error"
        error = [
          "code": -1,
          "message":
            "表示可能な view controller が見つからないため広告をロードできませんでした。"
            + "アプリの起動が完了してから、または BannerAdView をマウントしてから load() を呼び直してください。",
          "domain": "ExpoGoogleMobileAds",
        ]
        emitStatusChange()
        return
      }
      view.rootViewController = rootViewController

      let request = Request()
      if let keywords = requestOptions?["keywords"] as? [String] {
        request.keywords = keywords
      }
      if let contentUrl = requestOptions?["contentUrl"] as? String {
        request.contentURL = contentUrl
      }
      // networkExtras（アダプター固有の GADAdNetworkExtras）はメディエーションアダプター
      // 実装に依存するため未対応。特定のメディエーションを追加するタスクで実装する。
      view.load(request)
    }
  }

  /// 表示中の view controller をそのつど解決する。`BannerAdView` にまだマウントされていない
  /// （プリロード中の）場合は `Utilities.currentViewController()` がまだ何も返せないことがある
  /// ため、アプリのキーウィンドウの rootViewController にフォールバックする。
  private func resolveRootViewController() -> UIViewController? {
    if let vc = appContext?.utilities?.currentViewController() {
      return vc
    }
    return UIApplication.shared.connectedScenes
      .compactMap { ($0 as? UIWindowScene)?.keyWindow?.rootViewController }
      .first
  }

  private func emitStatusChange() {
    emit(event: "statusChange", payload: ["status": status, "error": error as Any])
  }

  /// JS 側が `release()` を呼んで SharedObject の登録が解除される直前に呼ばれる。
  /// `release()` は JS との結びつきを切るだけでネイティブ側の後始末はしてくれないため、
  /// ここでデリゲートを外し、課金クロージャを外し、View から取り除く。View 側の
  /// `currentAd` プロパティ自体は（Fabric のリサイクルで prepareForRecycle が呼ばれても）
  /// 誰も明示的に nil にしてくれないままになり得るが、少なくともネイティブの広告表示・
  /// インプレッション計測・イベント発火は確実に止める。
  override func sharedObjectWillRelease() {
    runOnMain {
      guard let view = _bannerView else { return }
      view.delegate = nil
      view.paidEventHandler = nil
      view.removeFromSuperview()
      currentAttachment = nil
    }
  }

  // MARK: - BannerViewDelegate callbacks (forwarded from BannerAdDelegateProxy)
  // GMA はこれらのコールバックを常にメインスレッドで呼ぶため、追加の runOnMain は不要。

  fileprivate func handleDidReceiveAd(_ bannerView: BannerView) {
    status = "loaded"
    loadedSize = [
      "width": bannerView.adSize.size.width,
      "height": bannerView.adSize.size.height,
    ]
    responseInfo = responseInfoToDictionary(bannerView.responseInfo)
    emitStatusChange()
  }

  fileprivate func handleDidFailToReceiveAd(withError err: Error) {
    status = "error"
    error = errorToDictionary(err)
    emitStatusChange()
  }

  fileprivate func handleDidRecordImpression() {
    emit(event: "impression")
  }

  fileprivate func handleDidRecordClick() {
    emit(event: "clicked")
  }
}

/// `BannerViewDelegate`（ObjC プロトコル）は `NSObjectProtocol` を要求するため、
/// `NSObject` を継承しない `BannerAd`（SharedObject）は直接は適合できない。
/// この NSObject ベースのプロキシが受け取ったイベントを `owner` の `handle...` メソッドへ転送する。
private final class BannerAdDelegateProxy: NSObject, BannerViewDelegate {
  weak var owner: BannerAd?

  func bannerViewDidReceiveAd(_ bannerView: BannerView) {
    owner?.handleDidReceiveAd(bannerView)
  }

  func bannerView(_ bannerView: BannerView, didFailToReceiveAdWithError error: Error) {
    owner?.handleDidFailToReceiveAd(withError: error)
  }

  func bannerViewDidRecordImpression(_ bannerView: BannerView) {
    owner?.handleDidRecordImpression()
  }

  func bannerViewDidRecordClick(_ bannerView: BannerView) {
    owner?.handleDidRecordClick()
  }
}
