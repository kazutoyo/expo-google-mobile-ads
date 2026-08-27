export type BannerAdStatus = 'loading' | 'loaded' | 'error';

export type AdapterResponse = {
  adapterClassName: string;
  latencyMillis: number;
  // description is deliberately omitted: the native side (GADAdNetworkResponseInfo)
  // has no public description property, so nothing is ever sent for it.
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
  // networkExtras is deliberately omitted: it requires mediation-adapter-specific
  // GADAdNetworkExtras/AdNetworkExtras, which can't be converted generically without
  // implementing a specific adapter. Keeping the field on the type while native silently
  // ignores it would be a false promise — something that looks like it works but doesn't —
  // so it stays off the type until it's actually implemented (adding a field later isn't
  // a breaking change).
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
