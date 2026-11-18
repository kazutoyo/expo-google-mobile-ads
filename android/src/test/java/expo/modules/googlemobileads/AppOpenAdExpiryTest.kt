package expo.modules.googlemobileads

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AppOpenAdExpiryTest {
  @Test fun deepSleepExpiresTheAdWithoutRunningTheHandler() {
    var elapsed = 0L
    val expiry = AppOpenAdExpiry { elapsed }
    expiry.markLoaded()
    elapsed = AppOpenAdExpiry.LIFETIME_MS - 1
    assertFalse(expiry.isExpired)
    // Device uptime and the Handler remain stopped; elapsedRealtime advances during sleep.
    elapsed++
    assertTrue(expiry.isExpired)
  }

  @Test fun reloadDoesNotInheritThePreviousDeadline() {
    var elapsed = 0L
    val expiry = AppOpenAdExpiry { elapsed }
    expiry.markLoaded()
    elapsed += 3 * 60 * 60 * 1000L
    expiry.markLoaded()
    elapsed += 60 * 60 * 1000L
    assertFalse(expiry.isExpired)
    elapsed += 3 * 60 * 60 * 1000L
    assertTrue(expiry.isExpired)
  }

  @Test fun releasedOrNeverLoadedAdsHaveNoDeadline() {
    var elapsed = 0L
    val expiry = AppOpenAdExpiry { elapsed }
    assertFalse(expiry.isExpired)
    expiry.markLoaded()
    expiry.clear()
    elapsed += 8 * 60 * 60 * 1000L
    assertFalse(expiry.isExpired)
  }
}
