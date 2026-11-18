import ExpoModulesCore
import GoogleMobileAds
import UIKit

/// SDK objects and attachments are main-thread-only; JS reads immutable snapshots under a lock.
final class NativeAdObject: SharedObject {
  let adUnitId: String
  let requestOptions: [String: Any?]?
  private let lock = NSLock()
  private var snapshot: [String: Any?] = ["status": "loading"]
  private var loader: AdLoader?
  private var proxy: NativeAdProxy?
  private var generation = 0
  private var released = false
  private(set) var ad: GoogleMobileAds.NativeAd?
  weak var attachment: NativeAdCardView?

  init(adUnitId: String, requestOptions: [String: Any?]?) {
    self.adUnitId = adUnitId
    self.requestOptions = requestOptions
    super.init()
  }

  func value(_ key: String) -> Any? {
    lock.lock()
    defer { lock.unlock() }
    return snapshot[key] ?? nil
  }

  private func update(_ values: [String: Any?]) {
    lock.lock()
    snapshot = values
    lock.unlock()
    emit(event: "statusChange", payload: values)
    attachment?.refresh()
  }

  func load() {
    DispatchQueue.main.async { [self] in
      guard !released else { return }
      generation += 1
      clearAd()
      update(["status": "loading"])
      let proxy = NativeAdProxy(owner: self, generation: generation)
      let loader = AdLoader(adUnitID: adUnitId, rootViewController: nil, adTypes: [.native], options: nil)
      self.proxy = proxy
      self.loader = loader
      loader.delegate = proxy
      let request = Request()
      request.keywords = requestOptions?["keywords"] as? [String]
      request.contentURL = requestOptions?["contentUrl"] as? String
      loader.load(request)
    }
  }

  func markLoadFailed(_ message: String) {
    DispatchQueue.main.async { [self] in
      guard !released else { return }
      generation += 1
      clearAd()
      update(["status": "error", "error": ["code": -1, "message": message, "domain": "ExpoGoogleMobileAds"]])
    }
  }

  fileprivate func loaded(_ ad: GoogleMobileAds.NativeAd, generation: Int, proxy: NativeAdProxy) {
    guard !released, generation == self.generation else { return }
    self.ad = ad
    ad.delegate = proxy
    update(["status": "loaded", "responseInfo": responseInfoToDictionary(ad.responseInfo), "assets": [
      "headline": ad.headline, "body": ad.body, "callToAction": ad.callToAction, "advertiser": ad.advertiser,
      "starRating": ad.starRating, "store": ad.store, "price": ad.price,
      "mediaAspectRatio": ad.mediaContent.aspectRatio
    ] as [String: Any?]])
  }

  fileprivate func failed(_ error: Error, generation: Int) {
    guard !released, generation == self.generation else { return }
    update(["status": "error", "error": errorToDictionary(error)])
  }

  private func clearAd() {
    loader?.delegate = nil
    loader = nil
    ad?.delegate = nil
    ad = nil
    proxy = nil
    attachment?.refresh()
  }

  override func sharedObjectWillRelease() {
    DispatchQueue.main.async { [self] in
      released = true
      generation += 1
      clearAd()
    }
  }
}

fileprivate final class NativeAdProxy: NSObject, NativeAdLoaderDelegate, NativeAdDelegate {
  weak var owner: NativeAdObject?
  let generation: Int
  init(owner: NativeAdObject, generation: Int) {
    self.owner = owner
    self.generation = generation
  }
  func adLoader(_ adLoader: AdLoader, didReceive nativeAd: GoogleMobileAds.NativeAd) {
    owner?.loaded(nativeAd, generation: generation, proxy: self)
  }
  func adLoader(_ adLoader: AdLoader, didFailToReceiveAdWithError error: Error) {
    owner?.failed(error, generation: generation)
  }
  func nativeAdDidRecordImpression(_ nativeAd: GoogleMobileAds.NativeAd) { owner?.emit(event: "impression") }
  func nativeAd(_ nativeAd: GoogleMobileAds.NativeAd, didRecordPaidEventWith value: AdValue) {
    owner?.emit(event: "paid", payload: ["value": value.value.doubleValue, "currencyCode": value.currencyCode,
                                        "precision": adValuePrecisionToString(value.precision)])
  }
  func nativeAdDidRecordClick(_ nativeAd: GoogleMobileAds.NativeAd) { owner?.emit(event: "clicked") }
}
