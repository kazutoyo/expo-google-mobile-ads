import GoogleMobileAds

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
