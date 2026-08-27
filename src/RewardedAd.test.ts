const mockRewardedAd = jest.fn();

jest.mock('./ExpoGoogleMobileAdsModule', () => ({
  __esModule: true,
  default: {
    get RewardedAd() {
      return mockRewardedAd;
    },
  },
}));

jest.mock('./initialization', () => ({ runWhenInitialized: jest.fn() }));

import { createRewardedAd } from './RewardedAd';

beforeEach(() => {
  jest.clearAllMocks();
  mockRewardedAd.mockImplementation(function (this: any) {
    this.status = 'loading';
    this.load = jest.fn();
    this.showAsync = jest.fn().mockResolvedValue(null);
    this.markLoadFailed = jest.fn();
  });
});

describe('RewardedAd.show', () => {
  it('rejects with notLoaded when the ad is still loading', async () => {
    const ad = createRewardedAd({ adUnitId: 'unit' });
    await expect(ad.show()).rejects.toMatchObject({ code: 'notLoaded' });
  });

  it('resolves with the reward the native side reports', async () => {
    const ad = createRewardedAd({ adUnitId: 'unit' });
    (ad as any).status = 'loaded';
    (ad as any).showAsync = jest.fn().mockResolvedValue({ type: 'coins', amount: 10 });
    await expect(ad.show()).resolves.toEqual({ type: 'coins', amount: 10 });
  });

  it('resolves with null when the ad was dismissed without earning a reward', async () => {
    const ad = createRewardedAd({ adUnitId: 'unit' });
    (ad as any).status = 'loaded';
    (ad as any).showAsync = jest.fn().mockResolvedValue(null);
    await expect(ad.show()).resolves.toBeNull();
  });

  it('surfaces a native presentation failure as failedToShow', async () => {
    const ad = createRewardedAd({ adUnitId: 'unit' });
    (ad as any).status = 'loaded';
    (ad as any).showAsync = jest.fn().mockRejectedValue(new Error('presentation failed'));
    await expect(ad.show()).rejects.toMatchObject({ code: 'failedToShow' });
  });
});
