import ExpoModulesCore
import GoogleMobileAds
// Google ships this format in its beta module, alongside the stable SDK.
import GoogleMobileAds_Private
import UIKit

/// All SDK/view access runs on main. Only the immutable state snapshot crosses to JS.
final class EmbeddedSwipeableInterstitialAd: SharedObject {
  private let adUnitId: String
  private let size: [String: Double]?
  private let maxScreenHoldDuration: Double
  private let requestOptions: [String: Any?]?
  private let stateLock = NSLock()
  private var state: (status: String, error: [String: Any?]?, responseInfo: [String: Any?]?, hold: Double) =
    ("loading", nil, nil, 0)
  var status: String { stateLock.withLock { state.status } }
  var error: [String: Any?]? { stateLock.withLock { state.error } }
  var responseInfo: [String: Any?]? { stateLock.withLock { state.responseInfo } }
  var minScreenHoldDuration: Double { stateLock.withLock { state.hold } }

  private var ad: GoogleMobileAds_Private.SwipeableInterstitialAd?
  private let proxy = SwipeableInterstitialDelegateProxy()
  private var loadId = 0
  private var released = false
  weak var attachment: SwipeableInterstitialAdView?
  var adView: UIView? { released ? nil : ad?.adView }

  init(adUnitId: String, size: [String: Double]?, maxScreenHoldDuration: Double,
       requestOptions: [String: Any?]?) {
    self.adUnitId = adUnitId
    self.size = size
    self.maxScreenHoldDuration = maxScreenHoldDuration
    self.requestOptions = requestOptions
    super.init()
    proxy.owner = self
  }

  func load() {
    DispatchQueue.main.async { [self] in
      guard !released else { return }
      loadId += 1
      let requestId = loadId
      tearDown()
      update(status: "loading")
      let request = Request()
      request.keywords = requestOptions?["keywords"] as? [String]
      request.contentURL = requestOptions?["contentUrl"] as? String
      let options = GoogleMobileAds_Private.SwipeableInterstitialAdOptions()
      options.maxScreenHoldDuration = maxScreenHoldDuration
      if let size, let width = size["width"], let height = size["height"] {
        options.adSize = CGSize(width: width, height: height)
      }
      GoogleMobileAds_Private.SwipeableInterstitialAd.load(with: adUnitId, request: request, options: options) {
        [weak self] loaded, error in
        DispatchQueue.main.async {
          guard let self, !self.released, self.loadId == requestId else { return }
          if let error {
            self.update(status: "error", error: errorToDictionary(error))
            return
          }
          guard let loaded else {
            self.fail("The SDK returned no swipeable interstitial ad.")
            return
          }
          self.ad = loaded
          loaded.delegate = self.proxy
          self.update(status: "loaded", responseInfo: responseInfoToDictionary(loaded.responseInfo),
                      hold: loaded.minScreenHoldDuration)
          self.attachment?.refresh()
        }
      }
    }
  }

  func markLoadFailed(_ message: String) {
    DispatchQueue.main.async { [self] in
      guard !released else { return }
      loadId += 1
      tearDown()
      fail(message)
    }
  }

  private func fail(_ message: String) {
    update(status: "error", error: ["code": -1, "message": message, "domain": "ExpoGoogleMobileAds"])
  }

  private func update(status: String, error: [String: Any?]? = nil,
                      responseInfo: [String: Any?]? = nil, hold: Double = 0) {
    stateLock.withLock { state = (status, error, responseInfo, hold) }
    emit(event: "statusChange", payload: ["status": status, "error": error] as [String: Any?])
  }

  func attachRootViewController(_ controller: UIViewController?) {
    ad?.rootViewController = controller
  }

  func emitIfCurrent(_ source: GoogleMobileAds_Private.SwipeableInterstitialAd, event: String,
                     payload: [String: Any?] = [:]) {
    guard !released, source === ad else { return }
    emit(event: event, payload: payload)
  }

  private func tearDown() {
    ad?.delegate = nil
    ad?.rootViewController = nil
    ad?.adView.removeFromSuperview()
    ad = nil
  }

  override func sharedObjectWillRelease() {
    DispatchQueue.main.async { [self] in
      released = true
      loadId += 1
      tearDown()
      attachment = nil
      proxy.owner = nil
    }
  }
}

private final class SwipeableInterstitialDelegateProxy: NSObject, SwipeableInterstitialAdDelegate {
  weak var owner: EmbeddedSwipeableInterstitialAd?

  func swipeableInterstitialAdDidRecordImpression(_ ad: GoogleMobileAds_Private.SwipeableInterstitialAd) {
    owner?.emitIfCurrent(ad, event: "impression")
  }
  func swipeableInterstitialAdDidRecordClick(_ ad: GoogleMobileAds_Private.SwipeableInterstitialAd) {
    owner?.emitIfCurrent(ad, event: "clicked")
  }
  func swipeableInterstitialAdWillPresentScreen(_ ad: GoogleMobileAds_Private.SwipeableInterstitialAd) {
    owner?.emitIfCurrent(ad, event: "screenPresented")
  }
  func swipeableInterstitialAdDidDismissScreen(_ ad: GoogleMobileAds_Private.SwipeableInterstitialAd) {
    owner?.emitIfCurrent(ad, event: "screenDismissed")
  }
  func swipeableInterstitialAdDidStartScreenHoldTimer(_ ad: GoogleMobileAds_Private.SwipeableInterstitialAd) {
    owner?.emitIfCurrent(ad, event: "screenHoldTimerStarted")
  }
  func swipeableInterstitialAd(_ ad: GoogleMobileAds_Private.SwipeableInterstitialAd,
                              didRecordPaidEventWith value: AdValue) {
    owner?.emitIfCurrent(ad, event: "paid", payload: [
      "value": value.value.doubleValue,
      "currencyCode": value.currencyCode,
      "precision": adValuePrecisionToString(value.precision),
    ])
  }
}
