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
    expect(getConsentInfoSnapshot()).toBe(obtained);
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
});
