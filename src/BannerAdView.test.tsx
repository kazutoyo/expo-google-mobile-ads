const mockNativeView = jest.fn((_props: any) => null);

// requireNativeViewManager() is called once when BannerAdView.tsx's module is evaluated
// (due to import hoisting, before this file's mockNativeView assignment runs), so returning
// mockNativeView directly would capture undefined because of that hoisting order. Return a
// wrapper that defers the lookup, referencing mockNativeView only when actually rendered.
jest.mock('expo-modules-core', () => ({
  requireNativeViewManager: () => (props: any) => mockNativeView(props),
}));

// Mirrors expo's own useEventListener (node_modules/expo/src/hooks/useEvent.ts).
jest.mock('expo', () => {
  const { useEffect, useRef } = require('react');
  return {
    useEventListener: (emitter: any, eventName: string, listener: any) => {
      const listenerRef = useRef(listener);
      listenerRef.current = listener;
      useEffect(() => {
        const subscription = emitter.addListener(eventName, (...args: any[]) =>
          listenerRef.current(...args)
        );
        return () => subscription.remove();
      }, [emitter, eventName]);
    },
  };
});
jest.mock('./ExpoGoogleMobileAdsModule', () => ({
  __esModule: true,
  default: { BannerAd: jest.fn() },
}));
jest.mock('./initialization', () => ({ runWhenInitialized: jest.fn() }));

import { act, render } from '@testing-library/react-native';

import { BannerAdView } from './BannerAdView';

const size = { width: 360, height: 50 };

function makeAd(overrides: any = {}) {
  const listeners = new Set<(payload: any) => void>();
  return {
    status: 'loading',
    size,
    __expo_shared_object_id__: 42,
    addListener(_eventName: string, listener: (payload: any) => void) {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    },
    emitStatusChange() {
      listeners.forEach((listener) => listener({ status: this.status, error: this.error }));
    },
    ...overrides,
  } as any;
}

const lastStyle = () => mockNativeView.mock.calls[mockNativeView.mock.calls.length - 1][0].style;

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

  // A released ad keeps reporting its old id (see `isReleased`), so the id cannot be used to
  // detect one. Handing native an id whose registry entry is gone throws
  // SharedObject.NotFoundException during prop application, and reading any real member —
  // `ad.size` included — throws in the render itself.
  it('renders an empty box for a released ad instead of passing its dead id to native', async () => {
    const ad = makeAd();
    for (const property of ['status', 'size', 'loadedSize', 'error']) {
      Object.defineProperty(ad, property, {
        get() {
          throw new Error('Unable to find the native shared object');
        },
      });
    }

    await render(<BannerAdView ad={ad} />);

    expect(mockNativeView.mock.calls[0][0]).toMatchObject({ ad: null });
    expect(lastStyle()).toEqual(expect.arrayContaining([{ width: 0, height: 0 }]));
  });

  it('reserves space using the requested size before the ad loads', async () => {
    const ad = makeAd({ size });

    await render(<BannerAdView ad={ad} />);

    expect(lastStyle()).toEqual(expect.arrayContaining([{ width: 360, height: 50 }]));
  });

  it('uses the actual returned size once loaded', async () => {
    const ad = makeAd({ status: 'loaded', size, loadedSize: { width: 390, height: 100 } });

    await render(<BannerAdView ad={ad} />);

    expect(lastStyle()).toEqual(expect.arrayContaining([{ width: 390, height: 100 }]));
  });

  // A preloaded ad is routinely rendered with no useBannerAdState anywhere (that is the
  // README's preload example), so nothing else re-renders when the ad finishes loading.
  it('adopts loadedSize on its own when the ad loads, with no parent re-render', async () => {
    const ad = makeAd();

    await render(<BannerAdView ad={ad} />);
    expect(lastStyle()).toEqual(expect.arrayContaining([{ width: 360, height: 50 }]));

    await act(async () => {
      ad.status = 'loaded';
      ad.loadedSize = { width: 390, height: 100 };
      ad.emitStatusChange();
    });

    expect(lastStyle()).toEqual(expect.arrayContaining([{ width: 390, height: 100 }]));
  });

  it('can be overridden with style', async () => {
    const ad = makeAd({ size });

    await render(<BannerAdView ad={ad} style={{ height: 200 }} />);

    const style = lastStyle();
    expect(style[style.length - 1]).toEqual({ height: 200 });
  });
});
