import { act, renderHook } from '@testing-library/react-native';

import { UNKNOWN_CONSENT_INFO, setConsentInfo, __resetForTesting } from '../consentStore';
import type { ConsentInfo } from '../types';
import { useConsentInfo } from './useConsentInfo';

const obtained: ConsentInfo = {
  status: 'obtained',
  canRequestAds: true,
  isConsentFormAvailable: true,
  privacyOptionsRequirement: 'required',
};

beforeEach(() => __resetForTesting());

describe('useConsentInfo', () => {
  it('reports nothing known before any consent call', async () => {
    const { result } = await renderHook(() => useConsentInfo());

    expect(result.current).toEqual(UNKNOWN_CONSENT_INFO);
  });

  it('re-renders with the new value when the store changes', async () => {
    const { result } = await renderHook(() => useConsentInfo());

    await act(async () => setConsentInfo(obtained));

    expect(result.current).toEqual(obtained);
  });

  it('gives every mounted consumer the same value', async () => {
    const first = await renderHook(() => useConsentInfo());
    const second = await renderHook(() => useConsentInfo());

    await act(async () => setConsentInfo(obtained));

    expect(first.result.current).toBe(second.result.current);
  });

  it('stops updating after unmount without warning', async () => {
    const warn = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = await renderHook(() => useConsentInfo());

    unmount();
    // Deliberately not wrapped in `act()`: React 19 removed the "setState on an unmounted
    // component" warning entirely, so the only remaining signal that would catch a regression
    // here is React's "not wrapped in act()" warning. Wrapping this call in `act()` would
    // suppress that warning too, making this assertion pass vacuously no matter what the hook
    // does. Do not "fix" this back into an `act()`-wrapped call.
    setConsentInfo(obtained);

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
