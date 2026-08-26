import ExpoModulesCore
import GoogleMobileAds
import UIKit

/// ビュー階層に入れずに保持・ロードできる広告インスタンス。
/// `BannerAdView` がマウント時に `bannerView` を addSubview し、アンマウント時は
/// removeFromSuperview するだけ — 破棄はしない。これにより画面遷移をまたいで再利用できる。
///
/// `SharedObject`（expo-modules-core）は `NSObject` を継承しない Swift クラスであるため、
/// `NSObjectProtocol` を要求する ObjC プロトコルの `BannerViewDelegate` に直接は適合できない
/// （`cannot declare conformance to 'NSObjectProtocol' in Swift` でビルドエラーになる）。
/// そのため NSObject ベースの小さなプロキシ `BannerAdDelegateProxy` 経由でイベントを受け取る。
final class BannerAd: SharedObject {
  /// ビュー階層に入れずに保持する。表示時に BannerAdView が addSubview する。
  let bannerView: BannerView

  /// リクエストしたサイズ。JS 側の `ad.size` になる。
  let requestedSize: [String: Any?]

  private let adUnitId: String
  private let requestOptions: [String: Any?]?
  private let delegateProxy = BannerAdDelegateProxy()

  private(set) var status: String = "loading"
  private(set) var error: [String: Any?]?
  private(set) var loadedSize: [String: Any?]?
  private(set) var responseInfo: [String: Any?]?

  init(adUnitId: String, size: [String: Any?], requestOptions: [String: Any?]?) {
    let width = size["width"] as? Double ?? 0
    let height = size["height"] as? Double ?? 0
    // GADAdSize は直接構築せず、SDK 提供の `adSizeFor(cgSize:)`（GADAdSizeFromCGSize）を使う。
    self.bannerView = BannerView(adSize: adSizeFor(cgSize: CGSize(width: width, height: height)))
    self.requestedSize = size
    self.adUnitId = adUnitId
    self.requestOptions = requestOptions
    super.init()

    delegateProxy.owner = self
    bannerView.adUnitID = adUnitId
    bannerView.delegate = delegateProxy
    // rootViewController はロードに必要。表示時に BannerAdView が上書きする。
    bannerView.rootViewController = UIApplication.shared.connectedScenes
      .compactMap { ($0 as? UIWindowScene)?.keyWindow?.rootViewController }
      .first
    // GMA では課金イベントはデリゲートではなくクロージャで通知される。
    bannerView.paidEventHandler = { [weak self] value in
      self?.emit(event: "paid", payload: [
        "value": value.value.doubleValue,
        "currencyCode": value.currencyCode,
        "precision": adValuePrecisionToString(value.precision),
      ])
    }
  }

  func load() {
    status = "loading"
    error = nil
    emitStatusChange()

    let request = Request()
    if let keywords = requestOptions?["keywords"] as? [String] {
      request.keywords = keywords
    }
    if let contentUrl = requestOptions?["contentUrl"] as? String {
      request.contentURL = contentUrl
    }
    // networkExtras（アダプター固有の GADAdNetworkExtras）は個々のメディエーションアダプター
    // 実装に依存するため未対応。特定のメディエーションを追加するタスクで実装する。
    bannerView.load(request)
  }

  private func emitStatusChange() {
    emit(event: "statusChange", payload: ["status": status, "error": error as Any])
  }

  // MARK: - BannerViewDelegate callbacks (forwarded from BannerAdDelegateProxy)

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
