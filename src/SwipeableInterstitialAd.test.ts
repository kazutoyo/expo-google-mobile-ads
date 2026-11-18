import { NativeObjects } from './ExpoGoogleMobileAdsModule';
import { createSwipeableInterstitialAd } from './SwipeableInterstitialAd';
import { runWhenInitialized } from './initialization';

jest.mock('./ExpoGoogleMobileAdsModule', () => ({
  NativeObjects: { SwipeableInterstitialAd: jest.fn() },
}));
jest.mock('./initialization', () => ({ runWhenInitialized: jest.fn() }));

const constructor = NativeObjects.SwipeableInterstitialAd as jest.Mock;
const queue = runWhenInitialized as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  constructor.mockImplementation(function (this: any) {
    let released = false;
    this.load = jest.fn();
    this.markLoadFailed = jest.fn();
    this.release = () => {
      released = true;
    };
    Object.defineProperty(this, 'status', {
      get() {
        if (released) throw new Error('Released');
        return 'loading';
      },
    });
  });
});

it('requests fullscreen with no hold requirement by default', () => {
  createSwipeableInterstitialAd({ adUnitId: 'unit' });
  expect(constructor).toHaveBeenCalledWith('unit', undefined, 0, undefined);
});

it('passes size, hold duration and targeting to native', () => {
  const size = { width: 360, height: 720 };
  const requestOptions = { keywords: ['game'], contentUrl: 'https://example.com' };
  createSwipeableInterstitialAd({
    adUnitId: 'unit',
    size,
    maxScreenHoldDuration: 5,
    requestOptions,
  });
  expect(constructor).toHaveBeenCalledWith('unit', size, 5, requestOptions);
});

it('waits for initialization and skips loading if released while waiting', () => {
  const ad = createSwipeableInterstitialAd({ adUnitId: 'unit' });
  expect(ad.load).not.toHaveBeenCalled();
  queue.mock.calls[0][0]();
  expect(ad.load).toHaveBeenCalledTimes(1);
  ad.release();
  queue.mock.calls[0][0]();
  expect(ad.load).toHaveBeenCalledTimes(1);
});

it('reports initialization failures and skips a released ad', () => {
  const ad = createSwipeableInterstitialAd({ adUnitId: 'unit' });
  queue.mock.calls[0][1](new Error('initialization failed'));
  expect(ad.markLoadFailed).toHaveBeenCalledWith(expect.stringContaining('initialization failed'));
  ad.release();
  queue.mock.calls[0][1](new Error('failed again'));
  expect(ad.markLoadFailed).toHaveBeenCalledTimes(1);
});

it.each([-1, 0.5, NaN, Infinity, 2147483648])('rejects an invalid hold duration %s', (duration) => {
  expect(() =>
    createSwipeableInterstitialAd({ adUnitId: 'unit', maxScreenHoldDuration: duration })
  ).toThrow(RangeError);
  expect(constructor).not.toHaveBeenCalled();
});

it.each([0, -1, 1.5, NaN, Infinity, 2147483648])(
  'rejects invalid requested dimensions %s',
  (dimension) => {
    for (const size of [
      { width: dimension, height: 720 },
      { width: 360, height: dimension },
    ]) {
      expect(() => createSwipeableInterstitialAd({ adUnitId: 'unit', size })).toThrow(RangeError);
    }
    expect(constructor).not.toHaveBeenCalled();
  }
);
