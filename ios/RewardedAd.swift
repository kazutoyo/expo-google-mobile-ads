import ExpoModulesCore
import GoogleMobileAds
import UIKit

/// The rewarded format. Registered with JS as `RewardedAd`.
///
/// Named `FullScreenRewardedAd` for the same reason as `FullScreenInterstitialAd`: GMA's
/// `GADRewardedAd` is `NS_SWIFT_NAME(RewardedAd)`, so reusing that name here would shadow it.
final class FullScreenRewardedAd: FullScreenAd {
  /// The loaded ad. Main thread only.
  private var ad: RewardedAd?

  // MARK: - The earned-reward latch
  //
  // `GADUserDidEarnRewardHandler` is `typedef void (^)(void)` — it takes **no parameters**. The
  // reward is read off `GADRewardedAd.adReward`, which is `nonnull` and already populated
  // *before* the ad is ever presented (that is what makes the JS-side `reward` property useful
  // for a "watch an ad for 10 coins" prompt).
  //
  // So a non-nil `adReward` is NOT evidence that anything was earned. The only signal is "the
  // zero-argument handler fired". `_didEarnReward` is that signal, and `showResult()` returns the
  // reward only when it is set — otherwise a user who dismissed the ad after two seconds would be
  // granted the reward anyway. Neither the compiler nor a unit test catches that; it is a
  // real-money bug.
  //
  // Guarded by its own lock rather than by "it is all on main": `reward` is read from the JS
  // thread through a `Property` getter. `_reward` is snapshotted at load time so neither reader
  // has to touch `ad`.
  private let rewardLock = NSLock()
  private var _didEarnReward = false
  private var _reward: [String: Any]?

  /// What this ad offers, readable before it is shown. Its presence says nothing about whether
  /// the reward was earned — only `showAsync()`'s resolved value does.
  var reward: [String: Any]? {
    rewardLock.lock()
    defer { rewardLock.unlock() }
    return _reward
  }

  override func loadAd(request: Request) {
    RewardedAd.load(with: adUnitId, request: request) { [weak self] ad, error in
      // Hopped to main for the same reason as the interstitial: the load completion handler is
      // not documented as main-thread, and everything below is main-thread state.
      DispatchQueue.main.async {
        self?.handleLoadCompletion(ad: ad, error: error)
      }
    }
  }

  private func handleLoadCompletion(ad: RewardedAd?, error: Error?) {
    if let error {
      handleLoadFailed(error)
      return
    }
    guard let ad else {
      handleLoadFailed(missingAdError())
      return
    }
    if shouldDiscardLoadResult {
      // Released, a show is in flight, or this ad has already been shown. See the same guard in
      // InterstitialAd.swift for why installing here would hang the show promise.
      //
      // It also closes the last latch hole: this is the only path that could have installed a new
      // `_reward` snapshot while an earlier ad's reward handler was still able to fire, which
      // would have returned the new ad's reward for the old ad's earn. An ad can only have been
      // presented if `showPromise != nil` (during) or `status == "shown"` (after), and both are
      // discarded here — so a snapshot can never be installed after any presentation.
      //
      // Dropping this ad is complete cleanup: its delegate and paid closure are still nil, so
      // returning releases the last reference and ARC frees it.
      return
    }
    // Two loads can overlap (the second `load()` clears `ad`, but the first request may still land
    // afterwards), so an earlier ad can be sitting here. This clears its delegate and paid closure
    // and resets the earned-reward latch. Safe here only because the guard above has ruled out a
    // presentation in flight.
    tearDownAd()
    ad.fullScreenContentDelegate = delegateProxy
    ad.paidEventHandler = { [weak self] value in
      self?.emitPaid(value)
    }
    self.ad = ad
    // Snapshot the offered reward now. It is available pre-show, and taking a copy keeps the
    // JS-side `reward` getter off both `ad` and the main thread.
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
      // Zero arguments — see the latch comment above.
      self?.handleUserDidEarnReward()
    }
    return true
  }

  private func handleUserDidEarnReward() {
    rewardLock.lock()
    _didEarnReward = true
    let reward = _reward
    rewardLock.unlock()
    // `_reward` is set whenever the ad loaded, and an ad can only be presented once it has, so
    // this is always non-nil here. Guarded rather than force-unwrapped anyway.
    if let reward {
      emit(event: "earnedReward", payload: reward)
    }
  }

  /// Resolves `showAsync()` with the reward **only if the handler actually fired**.
  override func showResult() -> [String: Any]? {
    rewardLock.lock()
    defer { rewardLock.unlock() }
    return _didEarnReward ? _reward : nil
  }

  /// Also **resets the latch**. `_didEarnReward` belongs to one presentation of one ad object; a
  /// flag left set from a previous ad would make the next `show()` resolve with a reward nobody
  /// earned. `load()` calls this before starting a new request, and `handleLoadCompletion` calls
  /// it before replacing an ad, so no load can ever begin with the latch already set.
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

/// `GADAdReward.amount` is an `NSDecimalNumber`; the JS-side `AdReward.amount` is a plain number
/// (Android's `RewardItem.getAmount()` is an `Int`). Rewards are whole-number quantities in
/// practice, so the double conversion is lossless for real values.
private func rewardToDictionary(_ reward: AdReward) -> [String: Any] {
  [
    "type": reward.type,
    "amount": reward.amount.doubleValue,
  ]
}
