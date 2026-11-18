import ExpoModulesCore
import GoogleMobileAds
import UIKit

final class FullScreenAppOpenAd: FullScreenAd {
  private var expiryTask: DispatchWorkItem?
  private var ad: AppOpenAd?
  private let expiry = AppOpenAdExpiry()
  private var foregroundObserver: NSObjectProtocol?
  var appOpenStatus: String {
    let current = status
    return current == "loaded" && expiry.isExpired ? "error" : current
  }

  private func revalidateExpiration(loadId: Int) {
    if expiry.isExpired { expireLoadedAd(loadId: loadId) }
  }

  override func loadAd(request: Request, loadId: Int) {
    AppOpenAd.load(with: adUnitId, request: request) { [weak self] ad, error in
      DispatchQueue.main.async {
        self?.handleLoadCompletion(ad: ad, error: error, loadId: loadId)
      }
    }
  }

  private func handleLoadCompletion(ad: AppOpenAd?, error: Error?, loadId: Int) {
    if let error {
      handleLoadFailed(error, loadId: loadId)
      return
    }
    guard let ad else {
      handleLoadFailed(missingAdError(), loadId: loadId)
      return
    }
    if isStaleLoadResult(loadId) || shouldDiscardLoadResult {
      return
    }
    tearDownAd()
    ad.fullScreenContentDelegate = delegateProxy
    ad.paidEventHandler = { [weak self] value in
      self?.emitPaid(value)
    }
    self.ad = ad
    expiry.markLoaded()
    handleLoaded(responseInfo: ad.responseInfo)
    let task = DispatchWorkItem { [weak self] in self?.revalidateExpiration(loadId: loadId) }
    expiryTask = task
    // Foreground revalidation covers suspension and deep sleep even if this timer is delayed.
    DispatchQueue.main.asyncAfter(deadline: .now() + 4 * 60 * 60, execute: task)
    foregroundObserver = NotificationCenter.default.addObserver(
      forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main
    ) { [weak self] _ in
      self?.revalidateExpiration(loadId: loadId)
    }
  }

  @MainActor
  override func presentAd(from viewController: UIViewController) -> Bool {
    guard appOpenStatus == "loaded", let ad else { return false }
    ad.present(from: viewController)
    return true
  }

  override func tearDownAd() {
    expiryTask?.cancel()
    expiryTask = nil
    expiry.clear()
    if let foregroundObserver { NotificationCenter.default.removeObserver(foregroundObserver) }
    foregroundObserver = nil
    ad?.fullScreenContentDelegate = nil
    ad?.paidEventHandler = nil
    ad = nil
  }
}
