import {
  ShowAdError,
  assertShowable,
  isFullScreenAdReleased,
  type FullScreenAdLike,
} from './FullScreenAd';

// FullScreenAd.ts imports runWhenInitialized from './initialization', which in turn requires
// the real native module. Neither is exercised by the tests below (assertShowable and
// isFullScreenAdReleased don't touch it), but the import chain still runs at module load time
// and throws "Cannot find native module" without this mock — same reason BannerAd.test.ts mocks it.
jest.mock('./initialization', () => ({
  runWhenInitialized: jest.fn(),
}));

function makeAd(status: string): FullScreenAdLike {
  return { status, load: jest.fn(), markLoadFailed: jest.fn() } as unknown as FullScreenAdLike;
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
