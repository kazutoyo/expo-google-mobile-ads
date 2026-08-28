import { useSyncExternalStore } from 'react';

import { getConsentInfoSnapshot, subscribeToConsentInfo } from '../consentStore';
import type { ConsentInfo } from '../types';

/**
 * Subscribes to the consent information last reported by the SDK.
 *
 * Read-only: calling this does not request anything. Something has to call `gatherConsent()` (or
 * one of the primitives) for there to be anything to read — before that every field is the
 * "nothing known" value, which is also the right thing to render.
 *
 * Unlike phase 1's and phase 2's hooks there is no shared object and no native subscription here.
 * UMP emits no events of its own: consent information only ever changes as the result of a call
 * this library made, so a plain JS store is the whole mechanism.
 *
 * ```tsx
 * function PrivacySettingsRow() {
 *   const { privacyOptionsRequirement } = useConsentInfo();
 *   if (privacyOptionsRequirement !== 'required') return null;
 *   return <Button title="Privacy options" onPress={() => showPrivacyOptionsForm()} />;
 * }
 * ```
 */
export function useConsentInfo(): ConsentInfo {
  return useSyncExternalStore(subscribeToConsentInfo, getConsentInfoSnapshot);
}
