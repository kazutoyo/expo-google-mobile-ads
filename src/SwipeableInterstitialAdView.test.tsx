import { act, render } from '@testing-library/react-native';

import { SwipeableInterstitialAdView } from './SwipeableInterstitialAdView';

const mockNativeView = jest.fn((_props: any) => null);

jest.mock('expo-modules-core', () => ({
  requireNativeViewManager: () => (props: any) => mockNativeView(props),
}));

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
  NativeObjects: { SwipeableInterstitialAd: jest.fn() },
}));
jest.mock('./initialization', () => ({ runWhenInitialized: jest.fn() }));

function makeAd(status = 'loading') {
  const listeners = new Set<() => void>();
  return {
    status,
    minScreenHoldDuration: 0,
    __expo_shared_object_id__: 42,
    addListener(_name: string, listener: () => void) {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    },
    emitStatusChange() {
      listeners.forEach((listener) => listener());
    },
  } as any;
}
const props = () => mockNativeView.mock.calls.at(-1)![0];
beforeEach(() => jest.clearAllMocks());

it('reserves the requested layout while loading and attaches by id when loaded', async () => {
  const ad = makeAd();
  const style = { width: 360, height: 720 };
  await render(<SwipeableInterstitialAdView ad={ad} style={style} />);
  expect(props()).toMatchObject({ ad: null, style });
  await act(async () => {
    ad.status = 'loaded';
    ad.emitStatusChange();
  });
  expect(props()).toMatchObject({ ad: 42, style });
  await act(async () => {
    ad.status = 'loading';
    ad.emitStatusChange();
  });
  expect(props().ad).toBeNull();
});

it('resets when replaced with a loading ad, without releasing either ad', async () => {
  const first = makeAd('loaded');
  const second = makeAd();
  const view = await render(<SwipeableInterstitialAdView ad={first} />);
  expect(props().ad).toBe(42);
  await view.rerender(<SwipeableInterstitialAdView ad={second} />);
  expect(props().ad).toBeNull();
  await act(async () => first.emitStatusChange());
  expect(props().ad).toBeNull();
});

it('never passes a released registry id to native', async () => {
  const ad = makeAd('loaded');
  Object.defineProperty(ad, 'status', {
    get() {
      throw new Error('Released');
    },
  });
  await render(<SwipeableInterstitialAdView ad={ad} />);
  expect(props().ad).toBeNull();
});

it('passes null if the shared object id is unavailable', async () => {
  const ad = makeAd('loaded');
  ad.__expo_shared_object_id__ = undefined;
  await render(<SwipeableInterstitialAdView ad={ad} />);
  expect(props().ad).toBeNull();
});
