import NativeModule from './ExpoGoogleMobileAdsModule';
import { getConsentInfoSnapshot, setConsentInfo } from './consentStore';
import type { ConsentErrorCode, ConsentInfo, ConsentRequestOptions } from './types';

/**
 * Thrown by every consent function. `code` says what went wrong.
 *
 * The code is decided on the native side, because the two SDKs number their errors differently
 * for the same situation — code `2` is `invalidAppID` on iOS and `INTERNET_ERROR` on Android.
 * The SDK's own numeric code is appended to `message`, and `cause` keeps the original rejection.
 */
export class ConsentError extends Error {
  readonly code: ConsentErrorCode;

  constructor(code: ConsentErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ConsentError';
    this.code = code;
  }
}

const CONSENT_ERROR_CODES: readonly ConsentErrorCode[] = [
  'network',
  'timeout',
  'invalidOperation',
  'misconfiguration',
  'formUnavailable',
  'internal',
  'noActivity',
  'unknown',
];

function toConsentError(error: unknown): ConsentError {
  const raw = (error as { code?: unknown } | null)?.code;
  // Anything the native side did not send collapses to 'unknown' rather than widening
  // ConsentErrorCode into "whatever string turned up".
  const code = CONSENT_ERROR_CODES.includes(raw as ConsentErrorCode)
    ? (raw as ConsentErrorCode)
    : 'unknown';
  const message = error instanceof Error ? error.message : String(error);
  return new ConsentError(code, message, { cause: error });
}

/**
 * Runs a native consent call, publishes its result to the store, and normalizes its failures.
 *
 * The store is only written on success: a failed call knows nothing new, and overwriting a good
 * snapshot with a guess would make `useConsentInfo()` report a state the SDK never reported.
 */
/**
 * Issue order for consent calls, so a superseded one cannot republish its result.
 *
 * Monotonic and never reset: only the relative order matters.
 */
let latestCallId = 0;

async function run(call: () => Promise<ConsentInfo>): Promise<ConsentInfo> {
  const callId = ++latestCallId;
  let info: ConsentInfo;
  try {
    info = await call();
  } catch (error) {
    throw toConsentError(error);
  }
  // Last request wins, and it is the order calls were *issued* in that decides — not the order
  // the SDK happens to settle them in. Without this, a slow `gatherConsent()` from app startup
  // can land after the user has withdrawn consent in the privacy options form and republish the
  // older, more permissive snapshot, so `canRequestAds` flips back to true for someone who just
  // said no. Phase 2 draws the same line for overlapping ad loads (`isStaleLoadResult` in
  // `ios/FullScreenAd.swift`).
  //
  // Only the store is held to this. The caller still gets its own result back, because it asked
  // for it — what must not happen is one shared snapshot going backwards for every subscriber.
  if (callId === latestCallId) {
    setConsentInfo(info);
  }
  return info;
}

/**
 * Requests the latest consent information and shows the consent form if one is required.
 *
 * This is the whole flow Google's guidance describes, in one call. Gate ad initialization on the
 * result:
 *
 * ```ts
 * const { canRequestAds } = await gatherConsent();
 * if (canRequestAds) await initialize();
 * ```
 *
 * The two steps are composed on the native side rather than here, so nothing can interleave
 * between them and Android resolves its Activity once instead of twice.
 */
export function gatherConsent(options?: ConsentRequestOptions): Promise<ConsentInfo> {
  return run(() => NativeModule.gatherConsentAsync(options));
}

/**
 * Requests the latest consent information without showing any form.
 *
 * Use this only when the form needs to be shown at a different moment than the update; otherwise
 * `gatherConsent()` does both.
 */
export function requestConsentInfoUpdate(options?: ConsentRequestOptions): Promise<ConsentInfo> {
  return run(() => NativeModule.requestConsentInfoUpdateAsync(options));
}

/**
 * Shows the consent form, but only if `status` is `'required'`. Resolves without showing anything
 * otherwise.
 *
 * Requires a preceding successful `requestConsentInfoUpdate()` — the SDK has nothing to decide
 * with until then.
 */
export function showConsentFormIfRequired(): Promise<ConsentInfo> {
  return run(() => NativeModule.showConsentFormIfRequiredAsync());
}

/**
 * Shows the privacy options form so the user can change a choice they already made.
 *
 * Only offer this while `privacyOptionsRequirement` is `'required'`.
 */
export function showPrivacyOptionsForm(): Promise<ConsentInfo> {
  return run(() => NativeModule.showPrivacyOptionsFormAsync());
}

/**
 * Reads the current consent information without contacting the network.
 *
 * Async because iOS's `UMPConsentInformation` is main-thread-only down to its property getters.
 */
export function getConsentInfo(): Promise<ConsentInfo> {
  return run(() => NativeModule.getConsentInfoAsync());
}

/**
 * Erases the stored consent so the form can be shown again. **Development builds only** — this is
 * a no-op when `__DEV__` is false, and resolves with the current snapshot instead.
 *
 * Without it a device can only be tested once: consent is persisted by the SDK, so after the form
 * has been answered it never appears again short of reinstalling the app.
 */
export function resetConsent(): Promise<ConsentInfo> {
  if (!__DEV__) return Promise.resolve(getConsentInfoSnapshot());
  return run(() => NativeModule.resetConsentAsync());
}
