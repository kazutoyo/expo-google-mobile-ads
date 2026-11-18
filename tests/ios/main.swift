import Foundation

struct AppOpenAdExpiryTests {
  func testSleepCountsEvenWhenAnUptimeTimerHasNotAdvanced() {
    var continuousNow = ContinuousClock.now
    let expiry = AppOpenAdExpiry(now: { continuousNow })
    expiry.markLoaded()
    continuousNow = continuousNow.advanced(by: .seconds(4 * 60 * 60 - 1))
    precondition(!expiry.isExpired)
    // Advance only the continuous clock, as during device sleep; no timer callback runs.
    continuousNow = continuousNow.advanced(by: .seconds(1))
    precondition(expiry.isExpired)
  }

  func testReloadGetsItsOwnDeadline() {
    var now = ContinuousClock.now
    let expiry = AppOpenAdExpiry(now: { now })
    expiry.markLoaded()
    now = now.advanced(by: .seconds(3 * 60 * 60))
    expiry.markLoaded()
    now = now.advanced(by: .seconds(60 * 60))
    precondition(!expiry.isExpired, "The previous load's timer must not expire this load")
    now = now.advanced(by: .seconds(3 * 60 * 60))
    precondition(expiry.isExpired)
  }

  func testReleaseClearsTheDeadline() {
    var now = ContinuousClock.now
    let expiry = AppOpenAdExpiry(now: { now })
    precondition(!expiry.isExpired)
    expiry.markLoaded()
    expiry.clear()
    now = now.advanced(by: .seconds(8 * 60 * 60))
    precondition(!expiry.isExpired)
  }
}

let tests = AppOpenAdExpiryTests()
tests.testSleepCountsEvenWhenAnUptimeTimerHasNotAdvanced()
tests.testReloadGetsItsOwnDeadline()
tests.testReleaseClearsTheDeadline()
print("AppOpenAdExpiry: 3 native Swift regression tests passed")
