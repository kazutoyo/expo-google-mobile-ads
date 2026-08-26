export type BannerAdStatus = 'loading' | 'loaded' | 'error';

export type AdapterResponse = {
  adapterClassName: string;
  latencyMillis: number;
  description: string;
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
  networkExtras?: Record<string, Record<string, string>>;
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
