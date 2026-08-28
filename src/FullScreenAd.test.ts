import {
  ShowAdError,
  assertShowable,
  isFullScreenAdReleased,
  loadFullScreenAdWhenInitialized,
  type FullScreenAdLike,
} from './FullScreenAd';
import { runWhenInitialized } from './initialization';

// FullScreenAd.ts imports runWhenInitialized from './initialization', which in turn requires
// the real native module. Neither is exercised by the assertShowable/isFullScreenAdReleased
// tests below, but the import chain still runs at module load time and throws "Cannot find
// native module" without this mock — same reason BannerAd.test.ts mocks it. The
// loadFullScreenAdWhenInitialized tests below drive both of its callbacks directly off this mock.
jest.mock('./initialization', () => ({
  runWhenInitialized: jest.fn(),
}));

const mockRunWhenInitialized = runWhenInitialized as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

function makeAd(status: string): FullScreenAdLike {
  return { status, load: jest.fn(), markLoadFailed: jest.fn() } as unknown as FullScreenAdLike;
}

// Mirrors a released shared object: every real property getter throws. See
// `isFullScreenAdReleased` in FullScreenAd.ts.
function makeReleasedAd(): FullScreenAdLike {
  return {
    get status(): string {
      throw new Error('SharedObject.NotFoundException');
    },
    load: jest.fn(),
    markLoadFailed: jest.fn(),
  } as unknown as FullScreenAdLike;
}

describe('assertShowable', () => {
  it('a loaded ad passes', () => {
    expect(() => assertShowable(makeAd('loaded'))).not.toThrow();
  });

  it('a loading ad is notLoaded', () => {
    expect(() => assertShowable(makeAd('loading'))).toThrow(
      expect.objectContaining({ code: 'notLoaded' })
    );
  });

  it('an errored ad is notLoaded', () => {
    expect(() => assertShowable(makeAd('error'))).toThrow(
      expect.objectContaining({ code: 'notLoaded' })
    );
  });

  it('a shown ad is alreadyShown, not notLoaded', () => {
    expect(() => assertShowable(makeAd('shown'))).toThrow(
      expect.objectContaining({ code: 'alreadyShown' })
    );
  });

  // Regression: `assertShowable` used to read `ad.status` first, so a released ad threw the raw
  // `SharedObject.NotFoundException` from the property getter instead of a `ShowAdError`.
  it('a released ad is notLoaded, not a raw SharedObject.NotFoundException', () => {
    let thrown: unknown;
    try {
      assertShowable(makeReleasedAd());
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ShowAdError);
    expect(thrown).toEqual(expect.objectContaining({ code: 'notLoaded' }));
    expect((thrown as Error).message).toContain('released');
  });

  it('the thrown error is a ShowAdError with a message naming the status', () => {
    try {
      assertShowable(makeAd('loading'));
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ShowAdError);
      expect((e as Error).message).toContain('loading');
    }
  });
});

describe('isFullScreenAdReleased', () => {
  it('a live ad is not released', () => {
    expect(isFullScreenAdReleased(makeAd('loaded'))).toBe(false);
  });

  it('an ad whose property getter throws is released', () => {
    const ad = {
      get status(): string {
        throw new Error('SharedObject.NotFoundException');
      },
    } as unknown as FullScreenAdLike;
    expect(isFullScreenAdReleased(ad)).toBe(true);
  });

  it('an ad whose property getter returns undefined is released', () => {
    expect(isFullScreenAdReleased({ status: undefined } as unknown as FullScreenAdLike)).toBe(true);
  });
});

describe('loadFullScreenAdWhenInitialized', () => {
  it('starts loading once the deferred task runs', () => {
    const ad = makeAd('loading');

    loadFullScreenAdWhenInitialized(ad);
    mockRunWhenInitialized.mock.calls[0][0]();

    expect(ad.load).toHaveBeenCalledTimes(1);
  });

  it('does not load an ad that was released while initialization was still pending', () => {
    const ad = makeReleasedAd();

    loadFullScreenAdWhenInitialized(ad);
    mockRunWhenInitialized.mock.calls[0][0]();

    expect(ad.load).not.toHaveBeenCalled();
  });

  it('marks the ad failed when initialization fails', () => {
    const ad = makeAd('loading');

    loadFullScreenAdWhenInitialized(ad);
    mockRunWhenInitialized.mock.calls[0][1](new Error('no network'));

    expect(ad.load).not.toHaveBeenCalled();
    expect(ad.markLoadFailed).toHaveBeenCalledWith(expect.stringContaining('no network'));
  });

  it('does not mark a released ad failed when initialization fails', () => {
    const ad = makeReleasedAd();

    loadFullScreenAdWhenInitialized(ad);
    mockRunWhenInitialized.mock.calls[0][1](new Error('no network'));

    expect(ad.markLoadFailed).not.toHaveBeenCalled();
  });
});
