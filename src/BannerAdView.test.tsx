const mockNativeView = jest.fn((_props: any) => null);

// requireNativeViewManager() is called once when BannerAdView.tsx's module is evaluated
// (due to import hoisting, before this file's mockNativeView assignment runs), so returning
// mockNativeView directly would capture undefined because of that hoisting order. Return a
// wrapper that defers the lookup, referencing mockNativeView only when actually rendered.
jest.mock('expo-modules-core', () => ({
  requireNativeViewManager: () => (props: any) => mockNativeView(props),
}));

import { render } from '@testing-library/react-native';

import { BannerAdView } from './BannerAdView';

const size = { width: 360, height: 50 };

function makeAd(overrides: any = {}) {
  return { status: 'loading', size, __expo_shared_object_id__: 42, ...overrides } as any;
}

beforeEach(() => jest.clearAllMocks());

describe('BannerAdView', () => {
  // Passing the SharedObject itself would get it frozen by DEV's deepFreezeAndThrowOnMutationInDev,
  // after which a later release() throws "failed to define internal native state property".
  it('passes the shared object id to the native view, not the SharedObject itself', async () => {
    const ad = makeAd();

    await render(<BannerAdView ad={ad} />);

    expect(mockNativeView.mock.calls[0][0]).toMatchObject({ ad: 42 });
  });

  // __expo_shared_object_id__ is deprecated; if native ever stops setting it, an unguarded
  // read would return undefined and React would omit the `ad` prop with no error at all.
  it('falls back to null (not undefined) when the shared object id is missing', async () => {
    const ad = makeAd({ __expo_shared_object_id__: undefined });

    await render(<BannerAdView ad={ad} />);

    expect(mockNativeView.mock.calls[0][0]).toMatchObject({ ad: null });
  });

  it('reserves space using the requested size before the ad loads', async () => {
    const ad = makeAd({ size });

    await render(<BannerAdView ad={ad} />);

    expect(mockNativeView.mock.calls[0][0].style).toEqual(
      expect.arrayContaining([{ width: 360, height: 50 }])
    );
  });

  it('uses the actual returned size once loaded', async () => {
    const ad = makeAd({ status: 'loaded', size, loadedSize: { width: 390, height: 100 } });

    await render(<BannerAdView ad={ad} />);

    expect(mockNativeView.mock.calls[0][0].style).toEqual(
      expect.arrayContaining([{ width: 390, height: 100 }])
    );
  });

  it('can be overridden with style', async () => {
    const ad = makeAd({ size });

    await render(<BannerAdView ad={ad} style={{ height: 200 }} />);

    const style = mockNativeView.mock.calls[0][0].style;
    expect(style[style.length - 1]).toEqual({ height: 200 });
  });
});
