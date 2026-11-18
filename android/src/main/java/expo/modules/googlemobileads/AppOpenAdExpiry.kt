package expo.modules.googlemobileads

/** The supplied clock is elapsedRealtime in production, including time spent in deep sleep. */
internal class AppOpenAdExpiry(private val now: () -> Long) {
  @Volatile private var loadedAt: Long? = null

  fun markLoaded() { loadedAt = now() }
  fun clear() { loadedAt = null }
  val isExpired: Boolean get() {
    val timestamp = loadedAt ?: return false
    return now() - timestamp >= LIFETIME_MS
  }

  companion object {
    const val LIFETIME_MS = 4 * 60 * 60 * 1000L
  }
}
