import ExpoModulesCore
import UserMessagingPlatform

/// Maps a UMP error onto the JS-facing `ConsentErrorCode`.
///
/// The numeric codes cannot be sent to JS as-is: `UMPErrorDomain` numbers `2` as
/// `invalidAppID`, while Android's `FormError.ErrorCode` numbers `2` as `INTERNET_ERROR`. The
/// same number would mean two different failures depending on the platform, so it is normalized
/// here and the raw number is appended to the message for diagnostics instead.
///
/// `UMPRequestErrorCode` (1...4) and `UMPFormErrorCode` (5...9) share one domain, so a single
/// switch covers both.
func consentErrorCode(_ error: NSError) -> String {
  guard error.domain == UMPErrorDomain else { return "unknown" }
  switch error.code {
  case 1, 5: return "internal"           // request internal, form internal
  case 2, 4: return "misconfiguration"   // invalidAppID, misconfiguration
  case 3: return "network"
  case 6, 9: return "invalidOperation"   // formAlreadyUsed, invalidViewController
  case 7: return "formUnavailable"
  case 8: return "timeout"
  default: return "unknown"
  }
}

func consentErrorMessage(_ error: NSError) -> String {
  "\(error.localizedDescription) (native code: \(error.code))"
}

/// Every UMP entry point is main-thread-only.
///
/// `UMPConsentInformation.h` states "Consent information. All methods must be called on the main
/// thread" for the whole class — property getters included — and every `UMPConsentForm` class
/// method carries "Must be called on the main queue".
///
/// This is why the JS API is async all the way down, including `getConsentInfo()`. The
/// alternative — a synchronous `Function` hopping to main with `DispatchQueue.main.sync` — is the
/// deadlock shape documented on `runOnMain` in `BannerAd.swift`, and unlike the banner size
/// helpers there is no requirement here that forces a synchronous answer.
@MainActor
enum Consent {
  static func snapshot() -> [String: Any] {
    let info = ConsentInformation.shared
    return [
      "status": statusString(info.consentStatus),
      "canRequestAds": info.canRequestAds,
      // Narrowed from iOS's three-valued `formStatus` to the boolean Android reports.
      // `.unknown` becomes false: an app can only branch on "can a form be shown", and Android
      // has no way to produce a third value. See `ConsentInfo.isConsentFormAvailable` in types.ts.
      "isConsentFormAvailable": info.formStatus == .available,
      "privacyOptionsRequirement": privacyString(info.privacyOptionsRequirementStatus),
    ]
  }

  static func requestInfoUpdate(_ options: [String: Any?]?) async throws {
    let parameters = makeRequestParameters(options)
    try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
      ConsentInformation.shared.requestConsentInfoUpdate(with: parameters) { error in
        if let error { continuation.resume(throwing: error) } else { continuation.resume() }
      }
    }
  }

  static func showFormIfRequired(from viewController: UIViewController?) async throws {
    try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
      ConsentForm.loadAndPresentIfRequired(from: viewController) { error in
        if let error { continuation.resume(throwing: error) } else { continuation.resume() }
      }
    }
  }

  static func showPrivacyOptionsForm(from viewController: UIViewController?) async throws {
    try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
      ConsentForm.presentPrivacyOptionsForm(from: viewController) { error in
        if let error { continuation.resume(throwing: error) } else { continuation.resume() }
      }
    }
  }

  static func reset() {
    ConsentInformation.shared.reset()
  }

  // MARK: - Conversions

  private static func statusString(_ status: ConsentStatus) -> String {
    switch status {
    case .required: return "required"
    case .notRequired: return "notRequired"
    case .obtained: return "obtained"
    default: return "unknown"
    }
  }

  private static func privacyString(_ status: PrivacyOptionsRequirementStatus) -> String {
    switch status {
    case .required: return "required"
    case .notRequired: return "notRequired"
    default: return "unknown"
    }
  }

  private static func makeRequestParameters(_ options: [String: Any?]?) -> RequestParameters {
    let parameters = RequestParameters()
    guard let options else { return parameters }

    if let underAge = options["tagForUnderAgeOfConsent"] as? Bool {
      parameters.isTaggedForUnderAgeOfConsent = underAge
    }

    if let debug = options["debugSettings"] as? [String: Any?] {
      let debugSettings = DebugSettings()
      if let testDeviceIds = debug["testDeviceIds"] as? [String] {
        debugSettings.testDeviceIdentifiers = testDeviceIds
      }
      if let geography = debug["geography"] as? String {
        switch geography {
        case "eea": debugSettings.geography = .EEA
        case "regulatedUsState": debugSettings.geography = .regulatedUSState
        case "other": debugSettings.geography = .other
        // `.notEEA` (2) is deprecated in favour of `.other` (4) and is deliberately not
        // reachable from JS — `DebugGeography` in types.ts has no member for it.
        default: debugSettings.geography = .disabled
        }
      }
      parameters.debugSettings = debugSettings
    }

    return parameters
  }
}
