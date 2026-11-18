import { act, render } from '@testing-library/react-native';

import { NativeAdView } from './NativeAdView';

const mockNativeView = jest.fn((_props: any) => null);

// requireNativeViewManager() is called once when NativeAdView.tsx's module is evaluated
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
  NativeObjects: { NativeAd: jest.fn() },
}));
jest.mock('./initialization', () => ({ runWhenInitialized: jest.fn() }));

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

beforeEach(() => jest.clearAllMocks());

it('passes the registry ID without freezing the shared object', async () => {
  await render(<NativeAdView ad={makeAd()} />);
  expect(mockNativeView.mock.calls[0][0].ad).toBe(42);
});
it('passes null for a released ad whose old registry ID remains', async () => {
  const ad = makeAd();
  Object.defineProperty(ad, 'status', {
    get() {
      throw new Error('released');
    },
  });
  await render(<NativeAdView ad={ad} />);
  expect(mockNativeView.mock.calls[0][0].ad).toBeNull();
});
it('supports mounting before load and observing the loaded assets', async () => {
  const ad = makeAd();
  await render(<NativeAdView ad={ad} />);
  await act(() => {
    ad.status = 'loaded';
    ad.assets = { headline: 'Test ad' };
    ad.emitStatusChange();
  });
  expect(mockNativeView.mock.calls.at(-1)[0].ad).toBe(42);
});
it('passes null when Expo provides no registry ID', async () => {
  await render(<NativeAdView ad={makeAd({ __expo_shared_object_id__: undefined })} />);
  expect(mockNativeView.mock.calls[0][0].ad).toBeNull();
});
