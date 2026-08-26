import GoogleMobileAds

/// `AdValuePrecision` を JS 側の `PaidEventValue.precision` 文字列に変換する。
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
    // 注意: `GADAdNetworkResponseInfo` に `description` という公開プロパティは存在しない。
    // 以前はここで NSObject 既定の `.description`（意味のあるヒューマンリーダブル文字列である
    // 保証がない、実質ゴミ値）を詰めていたため削除した。TypeScript 側の `AdapterResponse` 型から
    // `description` フィールドを外すのはコーディネーター側の対応待ち。
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
  // GAD プレフィックスは Swift 側でも落ちない（NS_TYPED_ENUM/NS_SWIFT_NAME が付いていない裸の定数のため）。
  if let info = nsError.userInfo[GADErrorUserInfoKeyResponseInfo] as? ResponseInfo {
    dict["responseInfo"] = responseInfoToDictionary(info)
  }
  return dict
}
