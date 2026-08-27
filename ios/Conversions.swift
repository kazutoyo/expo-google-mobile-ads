import GoogleMobileAds
import UIKit

/// Mirror of the JS-side `BannerAdAdaptiveKind` (see `src/BannerAdSize.ts`). A size that carries
/// one of these must be rebuilt through the matching SDK factory: every adaptive kind is a flag
/// on `GADAdSize.flags`, and `adSizeFor(cgSize:)` produces a *fixed custom* size (flags = 1)
/// instead, which tells Google's serving side "custom WxH" rather than "adaptive".
///
/// `GADAdSize.h` says outright: "Do not create a GADAdSize manually... Do not access any fields
/// directly", so the flag cannot simply be copied onto a size built from the numbers — the
/// factory is the only supported way to get it.
///
/// The orientation is part of the kind because each anchored factory returns a different height
/// for the same width; rebuilding an explicitly portrait size through the current-orientation
/// factory on a landscape device would silently retarget the request.
enum BannerAdSizeKind: String {
  case anchored
  case anchoredPortrait
  case anchoredLandscape
  case largeAnchored
  case largeAnchoredPortrait
  case largeAnchoredLandscape
  case inline
}

/// The single place the SDK's adaptive size factories are called. Both the module's size
/// functions and `BannerAd`'s reconstruction of a size that crossed the JS boundary go through
/// here, so the two can never disagree — and the deprecated anchored factories are deprecated in
/// exactly one place.
///
/// Most of these are documented as main-queue-only, so every caller is already on main.
///
/// `maxHeight` is only read for `.inline`; the anchored factories derive their own height.
func makeAdaptiveAdSize(kind: BannerAdSizeKind, width: Double, maxHeight: Double) -> AdSize {
  switch kind {
  case .anchored:
    return currentOrientationAnchoredAdaptiveBanner(width: width)
  case .anchoredPortrait:
    return portraitAnchoredAdaptiveBanner(width: width)
  case .anchoredLandscape:
    return landscapeAnchoredAdaptiveBanner(width: width)
  case .largeAnchored:
    return largeAnchoredAdaptiveBanner(width: width)
  case .largeAnchoredPortrait:
    return largePortraitAnchoredAdaptiveBanner(width: width)
  case .largeAnchoredLandscape:
    return largeLandscapeAnchoredAdaptiveBanner(width: width)
  case .inline:
    return inlineAdaptiveBanner(width: width, maxHeight: maxHeight)
  }
}

/// Rebuilds the ad size a `BannerAdSize` describes. Falls back to a fixed custom size when the
/// size carries no adaptive marker (the fixed constants: BANNER, MEDIUM_RECTANGLE, ...), which is
/// exactly what those want.
func makeAdSize(adaptiveKind: String?, width: Double, height: Double) -> AdSize {
  guard let adaptiveKind, let kind = BannerAdSizeKind(rawValue: adaptiveKind) else {
    return adSizeFor(cgSize: CGSize(width: width, height: height))
  }
  return makeAdaptiveAdSize(kind: kind, width: width, maxHeight: height)
}

/// Converts `AdValuePrecision` to the JS-side `PaidEventValue.precision` string.
func adValuePrecisionToString(_ precision: AdValuePrecision) -> String {
  switch precision {
  case .unknown:
    return "unknown"
  case .estimated:
    return "estimated"
  case .publisherProvided:
    return "publisherProvided"
  case .precise:
    return "precise"
  @unknown default:
    return "unknown"
  }
}

func responseInfoToDictionary(_ info: ResponseInfo?) -> [String: Any?]? {
  guard let info else { return nil }
  return [
    "responseId": info.responseIdentifier,
    "mediationAdapterClassName": info.loadedAdNetworkResponseInfo?.adNetworkClassName,
    "adSourceName": info.loadedAdNetworkResponseInfo?.adSourceName,
    // Note: `GADAdNetworkResponseInfo` has no public `description` property. This used to
    // fill in NSObject's default `.description` here (not guaranteed to be meaningful,
    // effectively garbage), which has been removed. Dropping the `description` field from
    // the TypeScript-side `AdapterResponse` type is pending on the coordinator's side.
    "adapterResponses": info.adNetworkInfoArray.map { network -> [String: Any?] in
      [
        "adapterClassName": network.adNetworkClassName,
        "latencyMillis": Int(network.latency * 1000),
        "adError": network.error.map { errorToDictionary($0) },
      ]
    },
  ]
}

func errorToDictionary(_ error: Error) -> [String: Any?] {
  let nsError = error as NSError
  var dict: [String: Any?] = [
    "code": nsError.code,
    "message": nsError.localizedDescription,
    "domain": nsError.domain,
  ]
  // The GAD prefix isn't dropped on the Swift side either (it's a bare constant without
  // NS_TYPED_ENUM/NS_SWIFT_NAME).
  if let info = nsError.userInfo[GADErrorUserInfoKeyResponseInfo] as? ResponseInfo {
    dict["responseInfo"] = responseInfoToDictionary(info)
  }
  return dict
}
