export type BannerAdStatus = 'loading' | 'loaded' | 'error';

export type AdapterResponse = {
  adapterClassName: string;
  latencyMillis: number;
  // description は意図的に含めていない: ネイティブ側（GADAdNetworkResponseInfo）に
  // 公開された description プロパティが存在せず、送られてこないため。
  adError?: { code: number; message: string; domain: string };
};

export type ResponseInfo = {
  responseId?: string;
  mediationAdapterClassName?: string;
  adSourceName?: string;
  adapterResponses: AdapterResponse[];
};

export type AdError = {
  code: number;
  message: string;
  domain: string;
  responseInfo?: ResponseInfo;
};

export type PaidEventValue = {
  value: number;
  currencyCode: string;
  precision: 'unknown' | 'estimated' | 'publisherProvided' | 'precise';
};

export type RequestOptions = {
  keywords?: string[];
  contentUrl?: string;
  // networkExtras は意図的に含めていない: メディエーションアダプター固有の
  // GADAdNetworkExtras/AdNetworkExtras を要求するため、具体的なアダプターを実装する
  // タスクなしに汎用的な変換ができない。フィールドを型に生やしたままネイティブ側で
  // 無視すると「効くはずのものが効かない」false な約束になるため、実装されるまでは
  // 型からも外す（後から追加してもフィールド追加は破壊的変更にならない）。
};

export type RequestConfiguration = {
  testDeviceIds?: string[];
  tagForChildDirectedTreatment?: boolean;
  tagForUnderAgeOfConsent?: boolean;
  maxAdContentRating?: 'G' | 'PG' | 'T' | 'MA';
};

export type InitializationStatus = {
  adapterStatuses: Record<
    string,
    { state: 'ready' | 'notReady'; description: string; latency: number }
  >;
};
