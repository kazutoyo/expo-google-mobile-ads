import type { ConsentInfo } from './types';

/**
 * What UMP reports before anything has asked it.
 *
 * Every field is the "nothing known / nothing permitted" value, which is also the correct thing
 * to render: an app reading `privacyOptionsRequirement` before `gatherConsent()` has run should
 * not show a privacy options button, and one reading `canRequestAds` should not load ads.
 */
export const UNKNOWN_CONSENT_INFO: ConsentInfo = {
  status: 'unknown',
  canRequestAds: false,
  isConsentFormAvailable: false,
  privacyOptionsRequirement: 'unknown',
};

let snapshot: ConsentInfo = UNKNOWN_CONSENT_INFO;
let listeners: (() => void)[] = [];

/**
 * The current snapshot.
 *
 * Returns the identical object until `setConsentInfo` replaces it, which is what
 * `useSyncExternalStore` requires: it compares by reference on every render, and a fresh object
 * each call would loop forever.
 */
export function getConsentInfoSnapshot(): ConsentInfo {
  return snapshot;
}

export function subscribeToConsentInfo(listener: () => void): () => void {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((existing) => existing !== listener);
  };
}

/**
 * Replaces the snapshot and notifies subscribers.
 *
 * Replaced wholesale rather than merged: every consent function resolves with a complete
 * `ConsentInfo` read from the SDK in one go, so merging could only ever mix two different points
 * in time.
 *
 * The listener list is copied before iterating. React unsubscribes from inside its own callback
 * when a component unmounts during an update, and mutating the live array mid-loop would skip the
 * next subscriber.
 */
export function setConsentInfo(info: ConsentInfo): void {
  snapshot = info;
  [...listeners].forEach((listener) => listener());
}

/** @internal Test-only. Clears both the snapshot and every subscriber. */
export function __resetForTesting(): void {
  snapshot = UNKNOWN_CONSENT_INFO;
  listeners = [];
}
