import { renderHook } from '@testing-library/react-native';

import NativeModule from '../ExpoGoogleMobileAdsModule';
import { useBannerAdSize } from './useBannerAdSize';

jest.mock('../ExpoGoogleMobileAdsModule', () => ({
  __esModule: true,
  default: {
    getLargeAnchoredAdaptiveSize: jest.fn(() => ({ width: 390, height: 100 })),
    getAnchoredAdaptiveSize: jest.fn(() => ({ width: 390, height: 50 })),
    getInlineAdaptiveSize: jest.fn(() => ({ width: 390, height: 120 })),
  },
}));

const mockUseWindowDimensions = jest.fn(() => ({ width: 390, height: 844 }));
jest.mock('react-native', () => ({
  Dimensions: { get: () => ({ width: 390, height: 844 }) },
  useWindowDimensions: () => mockUseWindowDimensions(),
}));

const mockNative = NativeModule as jest.Mocked<typeof NativeModule>;

beforeEach(() => jest.clearAllMocks());

describe('useBannerAdSize', () => {
  it('returns the size matching the spec', async () => {
    const { result } = await renderHook(() => useBannerAdSize({ type: 'largeAnchoredAdaptive' }));

    expect(result.current).toEqual({ width: 390, height: 100, adaptiveKind: 'largeAnchored' });
  });

  it('recalculates when the screen width changes', async () => {
    const { rerender } = await renderHook(() => useBannerAdSize({ type: 'largeAnchoredAdaptive' }));

    expect(mockNative.getLargeAnchoredAdaptiveSize).toHaveBeenCalledTimes(1);

    mockUseWindowDimensions.mockReturnValue({ width: 844, height: 390 });
    await rerender({});

    expect(mockNative.getLargeAnchoredAdaptiveSize).toHaveBeenCalledTimes(2);
  });
});
