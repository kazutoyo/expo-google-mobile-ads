import { createRewardedInterstitialAd } from './RewardedInterstitialAd';

const mockRewardedInterstitialAd = jest.fn();

jest.mock('./ExpoGoogleMobileAdsModule', () => ({
  __esModule: true,
  NativeObjects: {
    get RewardedInterstitialAd() {
      return mockRewardedInterstitialAd;
    },
  },
}));

jest.mock('./initialization', () => ({ runWhenInitialized: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  mockRewardedInterstitialAd.mockImplementation(function (this: any) {
    this.status = 'loading';
    this.load = jest.fn();
    this.showAsync = jest.fn().mockResolvedValue(null);
    this.markLoadFailed = jest.fn();
  });
});

describe('RewardedInterstitialAd.show', () => {
  it('rejects with notLoaded when the ad is still loading', async () => {
    const ad = createRewardedInterstitialAd({ adUnitId: 'unit' });
    await expect(ad.show()).rejects.toMatchObject({ code: 'notLoaded' });
  });

  it('resolves with the reward the native side reports', async () => {
    const ad = createRewardedInterstitialAd({ adUnitId: 'unit' });
    (ad as any).status = 'loaded';
    (ad as any).showAsync = jest.fn().mockResolvedValue({ type: 'coins', amount: 10 });
    await expect(ad.show()).resolves.toEqual({ type: 'coins', amount: 10 });
  });

  it('resolves with null when no reward callback has arrived by dismissal', async () => {
    const ad = createRewardedInterstitialAd({ adUnitId: 'unit' });
    (ad as any).status = 'loaded';
    (ad as any).showAsync = jest.fn().mockResolvedValue(null);
    await expect(ad.show()).resolves.toBeNull();
  });

  it('surfaces a native presentation failure as failedToShow', async () => {
    const ad = createRewardedInterstitialAd({ adUnitId: 'unit' });
    (ad as any).status = 'loaded';
    (ad as any).showAsync = jest.fn().mockRejectedValue(new Error('presentation failed'));
    await expect(ad.show()).rejects.toMatchObject({ code: 'failedToShow' });
  });

  it('attaches the original native error as cause', async () => {
    const ad = createRewardedInterstitialAd({ adUnitId: 'unit' });
    (ad as any).status = 'loaded';
    const nativeError = new Error('presentation failed');
    (ad as any).showAsync = jest.fn().mockRejectedValue(nativeError);
    await expect(ad.show()).rejects.toMatchObject({ cause: nativeError });
  });
});

it('keeps a late earnedReward subscription usable after show resolves null', async () => {
  const listeners = new Set<(reward: unknown) => void>();
  mockRewardedInterstitialAd.mockImplementationOnce(function (this: any) {
    this.status = 'loaded';
    this.load = jest.fn();
    this.markLoadFailed = jest.fn();
    this.showAsync = jest.fn().mockResolvedValue(null);
    this.addListener = jest.fn((_event, listener) => {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    });
  });
  const ad = createRewardedInterstitialAd({ adUnitId: 'mediated-unit' });
  const grantReward = jest.fn();
  const subscription = ad.addListener('earnedReward', grantReward);
  await expect(ad.show()).resolves.toBeNull();
  expect(grantReward).not.toHaveBeenCalled();
  const reward = { type: 'coins', amount: 10 };
  for (const listener of listeners) listener(reward);
  expect(grantReward).toHaveBeenCalledTimes(1);
  expect(grantReward).toHaveBeenCalledWith(reward);
  subscription.remove();
  expect(listeners.size).toBe(0);
});
