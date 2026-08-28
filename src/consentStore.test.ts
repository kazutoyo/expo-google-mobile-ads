import {
  UNKNOWN_CONSENT_INFO,
  getConsentInfoSnapshot,
  setConsentInfo,
  subscribeToConsentInfo,
  __resetForTesting,
} from './consentStore';
import type { ConsentInfo } from './types';

const obtained: ConsentInfo = {
  status: 'obtained',
  canRequestAds: true,
  isConsentFormAvailable: true,
  privacyOptionsRequirement: 'required',
};

beforeEach(() => __resetForTesting());

describe('consentStore', () => {
  it('starts out knowing nothing', () => {
    expect(getConsentInfoSnapshot()).toEqual(UNKNOWN_CONSENT_INFO);
  });

  // useSyncExternalStore re-reads getSnapshot on every render and re-renders whenever the
  // reference changes, so an unchanged store must hand back the identical object.
  it('returns a referentially stable snapshot until it changes', () => {
    expect(getConsentInfoSnapshot()).toBe(getConsentInfoSnapshot());
  });

  it('notifies subscribers when the snapshot changes', () => {
    const listener = jest.fn();
    subscribeToConsentInfo(listener);

    setConsentInfo(obtained);

    expect(listener).toHaveBeenCalledTimes(1);
    // Equality, not identity: the store deliberately copies rather than aliasing the caller's
    // object. Referential stability — what useSyncExternalStore actually requires — is that the
    // snapshot does not change between writes, and is covered by its own test above.
    expect(getConsentInfoSnapshot()).toEqual(obtained);
  });

  it('notifies every subscriber', () => {
    const first = jest.fn();
    const second = jest.fn();
    subscribeToConsentInfo(first);
    subscribeToConsentInfo(second);

    setConsentInfo(obtained);

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('stops notifying a subscriber that unsubscribed', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToConsentInfo(listener);

    unsubscribe();
    setConsentInfo(obtained);

    expect(listener).not.toHaveBeenCalled();
  });

  // A subscriber that unsubscribes from inside its own callback (React does exactly this when a
  // component unmounts during an update) must not shift the list out from under the loop and make
  // the next subscriber be skipped.
  it('notifies later subscribers even if an earlier one unsubscribes while being notified', () => {
    const second = jest.fn();
    const unsubscribeFirst = subscribeToConsentInfo(() => unsubscribeFirst());
    subscribeToConsentInfo(second);

    setConsentInfo(obtained);

    expect(second).toHaveBeenCalledTimes(1);
  });

  // The published snapshot is shared with every useConsentInfo() subscriber. If the store kept
  // the caller's own object, whoever called the consent function could change what everyone
  // else sees, with no consent operation behind it and no notification that it happened.
  it('does not alias the object it was given', () => {
    const mutable = { ...obtained };

    setConsentInfo(mutable);
    (mutable as { canRequestAds: boolean }).canRequestAds = false;

    expect(getConsentInfoSnapshot()).not.toBe(mutable);
    expect(getConsentInfoSnapshot().canRequestAds).toBe(true);
  });

  it('freezes the published snapshot', () => {
    setConsentInfo({ ...obtained });
    const snapshot = getConsentInfoSnapshot();

    expect(Object.isFrozen(snapshot)).toBe(true);

    try {
      (snapshot as { canRequestAds: boolean }).canRequestAds = false;
    } catch {
      // Strict mode throws; sloppy mode silently ignores. Either way the value must not change.
    }
    expect(getConsentInfoSnapshot().canRequestAds).toBe(true);
  });

  it('freezes the initial unknown snapshot too', () => {
    expect(Object.isFrozen(UNKNOWN_CONSENT_INFO)).toBe(true);
  });
});
