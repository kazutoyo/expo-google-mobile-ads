jest.mock('./ExpoGoogleMobileAdsModule', () => ({
  __esModule: true,
  default: {
    gatherConsentAsync: jest.fn(),
    requestConsentInfoUpdateAsync: jest.fn(),
    showConsentFormIfRequiredAsync: jest.fn(),
    showPrivacyOptionsFormAsync: jest.fn(),
    getConsentInfoAsync: jest.fn(),
    resetConsentAsync: jest.fn(),
  },
}));

import NativeModule from './ExpoGoogleMobileAdsModule';
import {
  ConsentError,
  gatherConsent,
  getConsentInfo,
  requestConsentInfoUpdate,
  resetConsent,
  showConsentFormIfRequired,
  showPrivacyOptionsForm,
} from './consent';
import { UNKNOWN_CONSENT_INFO, getConsentInfoSnapshot, __resetForTesting } from './consentStore';
import type { ConsentInfo } from './types';

const mockNative = NativeModule as jest.Mocked<typeof NativeModule>;

const obtained: ConsentInfo = {
  status: 'obtained',
  canRequestAds: true,
  isConsentFormAvailable: true,
  privacyOptionsRequirement: 'required',
};

beforeEach(() => {
  __resetForTesting();
  jest.clearAllMocks();
  mockNative.gatherConsentAsync.mockResolvedValue(obtained);
  mockNative.requestConsentInfoUpdateAsync.mockResolvedValue(obtained);
  mockNative.showConsentFormIfRequiredAsync.mockResolvedValue(obtained);
  mockNative.showPrivacyOptionsFormAsync.mockResolvedValue(obtained);
  mockNative.getConsentInfoAsync.mockResolvedValue(obtained);
  mockNative.resetConsentAsync.mockResolvedValue(UNKNOWN_CONSENT_INFO);
});

describe.each([
  ['gatherConsent', () => gatherConsent(), () => mockNative.gatherConsentAsync],
  [
    'requestConsentInfoUpdate',
    () => requestConsentInfoUpdate(),
    () => mockNative.requestConsentInfoUpdateAsync,
  ],
  [
    'showConsentFormIfRequired',
    () => showConsentFormIfRequired(),
    () => mockNative.showConsentFormIfRequiredAsync,
  ],
  [
    'showPrivacyOptionsForm',
    () => showPrivacyOptionsForm(),
    () => mockNative.showPrivacyOptionsFormAsync,
  ],
  ['getConsentInfo', () => getConsentInfo(), () => mockNative.getConsentInfoAsync],
] as const)('%s', (_name, call, nativeFn) => {
  it('calls its native function exactly once and resolves with what it returned', async () => {
    await expect(call()).resolves.toEqual(obtained);
    expect(nativeFn()).toHaveBeenCalledTimes(1);
  });

  it('publishes the result to the store', async () => {
    await call();
    expect(getConsentInfoSnapshot()).toEqual(obtained);
  });

  it('wraps a native rejection in a ConsentError carrying the normalized code', async () => {
    nativeFn().mockRejectedValue(
      Object.assign(new Error('No internet (native code: 3)'), { code: 'network' })
    );

    await expect(call()).rejects.toMatchObject({
      name: 'ConsentError',
      code: 'network',
      message: 'No internet (native code: 3)',
    });
    await expect(call()).rejects.toBeInstanceOf(ConsentError);
  });

  it('leaves the store untouched when the native call fails', async () => {
    nativeFn().mockRejectedValue(Object.assign(new Error('boom'), { code: 'internal' }));

    await expect(call()).rejects.toThrow();

    expect(getConsentInfoSnapshot()).toEqual(UNKNOWN_CONSENT_INFO);
  });

  // A code the native side never sends must not become a lie in the type. Anything unrecognised
  // collapses to 'unknown' rather than being passed through as-is.
  it('falls back to "unknown" for an unrecognised code', async () => {
    nativeFn().mockRejectedValue(Object.assign(new Error('???'), { code: 'ERR_SOMETHING_ELSE' }));

    await expect(call()).rejects.toMatchObject({ code: 'unknown' });
  });

  it('falls back to "unknown" when the rejection carries no code at all', async () => {
    nativeFn().mockRejectedValue(new Error('bare'));

    await expect(call()).rejects.toMatchObject({ code: 'unknown', message: 'bare' });
  });
});

describe('options', () => {
  it('passes options through to gatherConsent', async () => {
    const options = {
      tagForUnderAgeOfConsent: true,
      debugSettings: { testDeviceIds: ['abc'], geography: 'eea' as const },
    };

    await gatherConsent(options);

    expect(mockNative.gatherConsentAsync).toHaveBeenCalledWith(options);
  });

  it('passes options through to requestConsentInfoUpdate', async () => {
    const options = { debugSettings: { geography: 'regulatedUsState' as const } };

    await requestConsentInfoUpdate(options);

    expect(mockNative.requestConsentInfoUpdateAsync).toHaveBeenCalledWith(options);
  });
});

describe('resetConsent', () => {
  const originalDev = (global as { __DEV__: boolean }).__DEV__;
  afterEach(() => {
    (global as { __DEV__: boolean }).__DEV__ = originalDev;
  });

  it('resets the SDK and the store in a dev build', async () => {
    (global as { __DEV__: boolean }).__DEV__ = true;
    await gatherConsent();
    expect(getConsentInfoSnapshot()).toEqual(obtained);

    await expect(resetConsent()).resolves.toEqual(UNKNOWN_CONSENT_INFO);

    expect(mockNative.resetConsentAsync).toHaveBeenCalledTimes(1);
    expect(getConsentInfoSnapshot()).toEqual(UNKNOWN_CONSENT_INFO);
  });

  // Erasing a real user's consent in production is never wanted, so the native call is not even
  // reached: the guard is in JS so no build ships a path to it.
  it('does nothing in a production build and resolves with the current snapshot', async () => {
    (global as { __DEV__: boolean }).__DEV__ = true;
    await gatherConsent();
    (global as { __DEV__: boolean }).__DEV__ = false;

    await expect(resetConsent()).resolves.toEqual(obtained);

    expect(mockNative.resetConsentAsync).not.toHaveBeenCalled();
    expect(getConsentInfoSnapshot()).toEqual(obtained);
  });
});
