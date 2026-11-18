import Foundation

/// A continuous clock includes device sleep and is unaffected by wall-clock adjustments.
/// The lock also makes the synchronous JS status getter safe while main replaces the load.
final class AppOpenAdExpiry {
  private let now: () -> ContinuousClock.Instant
  private let lock = NSLock()
  private var deadline: ContinuousClock.Instant?
  private static let lifetime: Duration = .seconds(4 * 60 * 60)

  init(now: @escaping () -> ContinuousClock.Instant = { ContinuousClock.now }) {
    self.now = now
  }

  func markLoaded() {
    lock.lock()
    defer { lock.unlock() }
    deadline = now().advanced(by: Self.lifetime)
  }

  var isExpired: Bool {
    lock.lock()
    defer { lock.unlock() }
    guard let deadline else { return false }
    return now() >= deadline
  }

  func clear() {
    lock.lock()
    defer { lock.unlock() }
    deadline = nil
  }
}
