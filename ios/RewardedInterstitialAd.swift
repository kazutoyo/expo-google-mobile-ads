import ExpoModulesCore
import GoogleMobileAds
import UIKit

final class FullScreenRewardedInterstitialAd: FullScreenAd {
  private var ad: RewardedInterstitialAd?

  private let rewardLock = NSLock()
  private var _didEarnReward = false
  private var _reward: [String: Any]?

  var reward: [String: Any]? {
    rewardLock.lock()
    defer { rewardLock.unlock() }
    return _reward
  }

  override func loadAd(request: Request, loadId: Int) {
    RewardedInterstitialAd.load(with: adUnitId, request: request) { [weak self] ad, error in
      DispatchQueue.main.async {
        self?.handleLoadCompletion(ad: ad, error: error, loadId: loadId)
      }
    }
  }

  private func handleLoadCompletion(ad: RewardedInterstitialAd?, error: Error?, loadId: Int) {
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
    let reward = rewardToDictionary(ad.adReward)
    rewardLock.lock()
    _reward = reward
    rewardLock.unlock()
    handleLoaded(responseInfo: ad.responseInfo)
  }

  @MainActor
  override func presentAd(from viewController: UIViewController) -> Bool {
    guard let ad else { return false }
    ad.present(from: viewController) { [weak self] in
      self?.handleUserDidEarnReward()
    }
    return true
  }

  private func handleUserDidEarnReward() {
    rewardLock.lock()
    _didEarnReward = true
    let reward = _reward
    rewardLock.unlock()
    if let reward {
      emit(event: "earnedReward", payload: reward)
    }
  }

  override func showResult() -> [String: Any]? {
    rewardLock.lock()
    defer { rewardLock.unlock() }
    return _didEarnReward ? _reward : nil
  }

  override func tearDownAd() {
    ad?.fullScreenContentDelegate = nil
    ad?.paidEventHandler = nil
    ad = nil
    rewardLock.lock()
    _didEarnReward = false
    _reward = nil
    rewardLock.unlock()
  }
}

private func rewardToDictionary(_ reward: AdReward) -> [String: Any] {
  [
    "type": reward.type,
    "amount": reward.amount.doubleValue,
  ]
}
