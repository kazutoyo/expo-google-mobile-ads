import { createNativeAd } from './NativeAd';
import { runWhenInitialized } from './initialization';

const mockNativeAd = jest.fn();
jest.mock('./ExpoGoogleMobileAdsModule', () => ({
  NativeObjects: {
    get NativeAd() {
      return mockNativeAd;
    },
  },
}));
jest.mock('./initialization', () => ({ runWhenInitialized: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  mockNativeAd.mockImplementation(function (this: any) {
    this.status = 'loading';
    this.load = jest.fn();
    this.markLoadFailed = jest.fn();
  });
});
it('defers loading until SDK initialization and forwards targeting options', () => {
  const requestOptions = { keywords: ['books'] };
  const ad = createNativeAd({ adUnitId: 'unit', requestOptions });
  expect(mockNativeAd).toHaveBeenCalledWith('unit', requestOptions);
  expect(ad.load).not.toHaveBeenCalled();
  jest.mocked(runWhenInitialized).mock.calls[0][0]();
  expect(ad.load).toHaveBeenCalledTimes(1);
});
it('does not load after release while initialization is pending', () => {
  const ad = createNativeAd({ adUnitId: 'unit' });
  Object.defineProperty(ad, 'status', {
    get() {
      throw new Error('released');
    },
  });
  jest.mocked(runWhenInitialized).mock.calls[0][0]();
  expect(ad.load).not.toHaveBeenCalled();
});
it('reports initialization failure rather than leaving the ad loading', () => {
  const ad = createNativeAd({ adUnitId: 'unit' });
  jest.mocked(runWhenInitialized).mock.calls[0][1](new Error('offline'));
  expect(ad.markLoadFailed).toHaveBeenCalledWith(expect.stringContaining('offline'));
});
