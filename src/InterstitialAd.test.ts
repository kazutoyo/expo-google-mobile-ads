const mockInterstitialAd = jest.fn();

jest.mock('./ExpoGoogleMobileAdsModule', () => ({
  __esModule: true,
  default: {
    get InterstitialAd() {
      return mockInterstitialAd;
    },
  },
}));

jest.mock('./initialization', () => ({ runWhenInitialized: jest.fn() }));

import { runWhenInitialized } from './initialization';
import { createInterstitialAd } from './InterstitialAd';

const mockRunWhenInitialized = runWhenInitialized as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockInterstitialAd.mockImplementation(function (this: any) {
    this.status = 'loading';
    this.load = jest.fn();
    this.showAsync = jest.fn().mockResolvedValue(undefined);
    this.markLoadFailed = jest.fn();
  });
});

describe('createInterstitialAd', () => {
  it('constructs the native ad with the ad unit id and request options', () => {
    const requestOptions = { keywords: ['game'] };
    createInterstitialAd({ adUnitId: 'unit', requestOptions });
    expect(mockInterstitialAd).toHaveBeenCalledWith('unit', requestOptions);
  });

  it('does not load directly — it defers until initialization completes', () => {
    const ad = createInterstitialAd({ adUnitId: 'unit' });
    expect((ad as any).load).not.toHaveBeenCalled();
    expect(mockRunWhenInitialized).toHaveBeenCalledTimes(1);
  });

  it('loads when the deferred task runs', () => {
    const ad = createInterstitialAd({ adUnitId: 'unit' });
    mockRunWhenInitialized.mock.calls[0][0]();
    expect((ad as any).load).toHaveBeenCalledTimes(1);
  });
});

describe('InterstitialAd.show', () => {
  it('rejects with notLoaded when the ad is still loading, without calling native', async () => {
    const ad = createInterstitialAd({ adUnitId: 'unit' });
    await expect(ad.show()).rejects.toMatchObject({ code: 'notLoaded' });
    expect((ad as any).showAsync).not.toHaveBeenCalled();
  });

  it('rejects with alreadyShown for an ad that was already shown', async () => {
    const ad = createInterstitialAd({ adUnitId: 'unit' });
    (ad as any).status = 'shown';
    await expect(ad.show()).rejects.toMatchObject({ code: 'alreadyShown' });
    expect((ad as any).showAsync).not.toHaveBeenCalled();
  });

  it('calls native showAsync for a loaded ad', async () => {
    const ad = createInterstitialAd({ adUnitId: 'unit' });
    (ad as any).status = 'loaded';
    await expect(ad.show()).resolves.toBeUndefined();
    expect((ad as any).showAsync).toHaveBeenCalledTimes(1);
  });

  it('surfaces a native presentation failure as failedToShow', async () => {
    const ad = createInterstitialAd({ adUnitId: 'unit' });
    (ad as any).status = 'loaded';
    (ad as any).showAsync = jest.fn().mockRejectedValue(new Error('presentation failed'));
    await expect(ad.show()).rejects.toMatchObject({ code: 'failedToShow' });
  });

  it('attaches the original native error as cause', async () => {
    const ad = createInterstitialAd({ adUnitId: 'unit' });
    (ad as any).status = 'loaded';
    const nativeError = new Error('presentation failed');
    (ad as any).showAsync = jest.fn().mockRejectedValue(nativeError);
    await expect(ad.show()).rejects.toMatchObject({ cause: nativeError });
  });
});
