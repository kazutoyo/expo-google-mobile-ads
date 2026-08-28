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

/**
 * A full-screen ad's lifecycle. `'shown'` is terminal: these ads are one-shot on both SDKs
 * (iOS reports `AdAlreadyUsed`, Android `AD_REUSED`), so a shown ad is never reloaded —
 * create a new one instead.
 */
export type FullScreenAdStatus = 'loading' | 'loaded' | 'shown' | 'error';

/** What the user earned from a rewarded ad. */
export type AdReward = {
  type: string;
  amount: number;
};

/**
 * Why `show()` rejected.
 *
 * `notLoaded` and `alreadyShown` are decided from the ad's own `status` before anything
 * reaches the SDK: Android has no readiness check at all (no `isReady`/`canShow`/`isLoaded`
 * anywhere in the Next-Gen SDK), so asking the SDK is not an option, and deciding it
 * ourselves makes both platforms behave identically.
 *
 * `notLoaded` also covers an ad that has been released: it can never be shown again, and it is
 * not `alreadyShown` because releasing an ad says nothing about whether it was ever presented.
 *
 * `failedToShow` comes from the SDK's own presentation failure callback.
 */
export type ShowAdErrorCode = 'notLoaded' | 'alreadyShown' | 'failedToShow';

/**
 * Whether the user's consent is needed, and whether it has been given.
 *
 * Mirrors UMP's own enum on both platforms (`UMPConsentStatus` / `ConsentInformation.ConsentStatus`).
 * `'unknown'` is the state before `requestConsentInfoUpdate()` has ever succeeded — it is not an
 * error, just "nothing has been asked yet".
 */
export type ConsentStatus = 'unknown' | 'required' | 'notRequired' | 'obtained';

/**
 * Whether the app must offer a privacy options entry point in its own settings UI.
 *
 * Show that entry point only while this is `'required'`, and open it with
 * `showPrivacyOptionsForm()`.
 */
export type PrivacyOptionsRequirementStatus = 'unknown' | 'required' | 'notRequired';

/**
 * Which region the SDK should pretend the device is in, for testing consent flows.
 *
 * Only applies to devices listed in `ConsentRequestOptions.debugSettings.testDeviceIds`; it is
 * ignored on every other device, on both platforms.
 */
export type DebugGeography = 'disabled' | 'eea' | 'regulatedUsState' | 'other';

/**
 * A snapshot of what UMP currently knows. Every consent function resolves with one.
 *
 * Read-only, and frozen at runtime by the store: the published snapshot is shared with every
 * `useConsentInfo()` subscriber, so a consumer mutating the object it was handed would change
 * what everyone else sees without any consent operation having happened and without notifying
 * anyone.
 */
export type ConsentInfo = Readonly<{
  status: ConsentStatus;
  /**
   * Whether ads may be requested right now. This — not `status` — is what gates
   * `initialize()` and ad loading: it is already true for a user whose consent is not required
   * at all, and for one who consented only to the minimum needed to serve ads.
   */
  canRequestAds: boolean;
  /**
   * Whether a consent form can currently be shown.
   *
   * iOS reports three values (`UMPFormStatus`: unknown / available / unavailable) and Android
   * only a boolean, so this is narrowed to the boolean both can produce — iOS's `unknown` is
   * reported as `false`. Nothing an app can do differs between "unknown" and "unavailable".
   */
  isConsentFormAvailable: boolean;
  privacyOptionsRequirement: PrivacyOptionsRequirementStatus;
}>;

export type ConsentRequestOptions = {
  /**
   * Tags the request as being for a user under the age of consent.
   *
   * This is UMP's own flag and is **separate** from `RequestConfiguration.tagForUnderAgeOfConsent`,
   * which GMA uses when requesting ads. Setting one does not set the other; pass it to both if
   * both apply.
   */
  tagForUnderAgeOfConsent?: boolean;
  /** Only takes effect in debug builds, and only on the listed devices. */
  debugSettings?: {
    /**
     * iOS takes the identifier for vendor; Android takes a hashed device ID. Both SDKs print the
     * value the device needs to the console/logcat on the first consent request, so run once
     * without this and copy the id out of the log.
     */
    testDeviceIds?: string[];
    geography?: DebugGeography;
  };
};

/**
 * Why a consent call failed.
 *
 * Normalized on the native side, because the raw numeric codes disagree across platforms: code
 * `2` is `invalidAppID` on iOS but `INTERNET_ERROR` on Android. The SDK's own numeric code is
 * appended to the error message for diagnostics.
 *
 * `'misconfiguration'` and `'formUnavailable'` are only ever produced on iOS — Android's UMP has
 * no equivalent code and reports those situations as `'internal'` or `'invalidOperation'`.
 * `'noActivity'` is produced by this library, not by either SDK: it means an Android consent call
 * arrived while no Activity was in the foreground.
 */
export type ConsentErrorCode =
  | 'network'
  | 'timeout'
  | 'invalidOperation'
  | 'misconfiguration'
  | 'formUnavailable'
  | 'internal'
  | 'noActivity'
  | 'unknown';
