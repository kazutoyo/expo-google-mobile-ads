import { createBannerAd } from './BannerAd';
import NativeModule from './ExpoGoogleMobileAdsModule';
import { runWhenInitialized } from './initialization';

jest.mock('./ExpoGoogleMobileAdsModule', () => ({
  __esModule: true,
  default: { BannerAd: jest.fn() },
}));

jest.mock('./initialization', () => ({
  runWhenInitialized: jest.fn(),
}));

// babel-jest hoists the `import` requires above a plain top-level `const`,
// so a jest.fn() declared before jest.mock() would be captured as `undefined`
// inside the factory. Define the mock inline in the factory instead, and
// grab the reference afterwards (same pattern as BannerAdSize.test.ts).
const mockNativeBannerAd = NativeModule.BannerAd as jest.Mock;
const mockRunWhenInitialized = runWhenInitialized as jest.Mock;
const size = { width: 360, height: 50 };

let nextSharedObjectId = 1;

beforeEach(() => {
  jest.clearAllMocks();
  mockNativeBannerAd.mockImplementation(function (this: any) {
    this.load = jest.fn();
    this.markLoadFailed = jest.fn();
    // Mirrors a real released shared object: the id keeps reporting its old value, while
    // every real property getter throws. See `isReleased` in BannerAd.ts.
    this.__expo_shared_object_id__ = nextSharedObjectId++;
    let released = false;
    Object.defineProperty(this, 'status', {
      get() {
        if (released) throw new Error('Unable to find the native shared object');
        return 'loading';
      },
    });
    this.release = jest.fn(() => {
      released = true;
    });
  });
});

describe('createBannerAd', () => {
  it('creates and returns the native BannerAd', () => {
    const ad = createBannerAd({ adUnitId: 'unit', size });

    expect(mockNativeBannerAd).toHaveBeenCalledWith('unit', size, undefined);
    expect(ad).toBeInstanceOf(mockNativeBannerAd);
  });

  it('passes requestOptions through to native', () => {
    const requestOptions = { keywords: ['game'] };

    createBannerAd({ adUnitId: 'unit', size, requestOptions });

    expect(mockNativeBannerAd).toHaveBeenCalledWith('unit', size, requestOptions);
  });

  it('does not call load directly, defers it until initialization completes', () => {
    const ad = createBannerAd({ adUnitId: 'unit', size });

    expect((ad as any).load).not.toHaveBeenCalled();
    expect(mockRunWhenInitialized).toHaveBeenCalledTimes(1);
  });

  it('starts loading once the deferred task runs', () => {
    const ad = createBannerAd({ adUnitId: 'unit', size });

    mockRunWhenInitialized.mock.calls[0][0]();

    expect((ad as any).load).toHaveBeenCalledTimes(1);
  });

  // A queued load can outlive its ad: useBannerAd releases the ad on unmount or on a dependency
  // change, while initialize() is still in flight. load() on a released shared object throws,
  // out of the promise callback draining the queue, taking every task behind it with it.
  it('does not load an ad that was released while initialization was still pending', () => {
    const ad = createBannerAd({ adUnitId: 'unit', size });

    ad.release();
    mockRunWhenInitialized.mock.calls[0][0]();

    expect((ad as any).load).not.toHaveBeenCalled();
  });

  it('marks the ad failed when initialization fails', () => {
    const ad = createBannerAd({ adUnitId: 'unit', size });

    mockRunWhenInitialized.mock.calls[0][1](new Error('no network'));

    expect((ad as any).load).not.toHaveBeenCalled();
    expect((ad as any).markLoadFailed).toHaveBeenCalledWith(expect.stringContaining('no network'));
  });

  it('does not mark a released ad failed when initialization fails', () => {
    const ad = createBannerAd({ adUnitId: 'unit', size });

    ad.release();
    mockRunWhenInitialized.mock.calls[0][1](new Error('no network'));

    expect((ad as any).markLoadFailed).not.toHaveBeenCalled();
  });
});
