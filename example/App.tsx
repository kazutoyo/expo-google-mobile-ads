import { useEffect, useState } from 'react';
import {
  Button,
  Dimensions,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import {
  BannerAdSize,
  BannerAdView,
  createBannerAd,
  initialize,
  useBannerAd,
  useBannerAdSize,
  useBannerAdState,
  type BannerAd,
} from 'expo-google-mobile-ads';

const TEST_BANNER_UNIT_ID = 'ca-app-pub-3940256099942544/9214589741';
// Not a real Google test ad unit — a made-up, non-existent ID. Used for the error QA case.
const BAD_BANNER_UNIT_ID = 'ca-app-pub-3940256099942544/0000000000';

// Total left+right padding of styles.card itself. Subtracting this from the card's own
// onLayout width (its outer box size) gives the width actually available to its children.
const CARD_PADDING = 16 * 2;
// Total left+right padding of styles.content (the ScrollView's contentContainer). Needed
// on top of the card's own padding to derive the card's outer size from the screen width
// (these are two separate padding layers).
const CONTENT_PADDING = 16 * 2;
// Combined inset used to analytically derive the card's inner width from the screen width
// (= both padding layers added together). Subtracting only one layer causes overflow again
// (this actually happened once).
const HORIZONTAL_INSET = CARD_PADDING + CONTENT_PADDING;

// Delay before initialize() is called, in ms. Set it to 5000 by hand for the QA items that
// need a wide "SDK is still initializing" window (the deferred-load item, and the
// "unmount while initialize() is in flight" item).
const INITIALIZE_DELAY_MS = 0;

// Initialize on app start and preload an ad outside of React.
//
// When testing the "initialization order" QA items, edit this by hand:
//   - comment it out to check that the __DEV__ warning fires
//   - set INITIALIZE_DELAY_MS above to check it still loads after the delay
function startInitialization() {
  initialize().then(
    (status) => console.log('[QA] initialize() resolved', status),
    (error) => console.log('[QA] initialize() rejected', error)
  );
}

if (INITIALIZE_DELAY_MS > 0) {
  setTimeout(startInitialization, INITIALIZE_DELAY_MS);
} else {
  startInitialization();
}

// Preloading happens before any View exists (outside React), so we can't measure the
// container with onLayout. styles.card's padding is a known constant, so we subtract it
// analytically from the screen width to get "the width the banner will actually occupy".
// The screen width could change later (rotation), but this ad is never reloaded after
// preloading, so we just use the screen width at creation time.
const preloadedAd = createBannerAd({
  adUnitId: TEST_BANNER_UNIT_ID,
  size: BannerAdSize.largeAnchoredAdaptive({
    width: Dimensions.get('window').width - HORIZONTAL_INSET,
  }),
});

// An ad rendered by a component that does NOT subscribe with `useBannerAdState` — exactly the
// README's preload example. The "loadedSize read at render" text below is read during render
// with no subscription, so it shows whether anything re-renders when the ad finishes loading.
// (Google's test ad units always serve exactly the requested size, so `loadedSize` matching
// `size` here is expected; the point of this card is the re-render, not the numbers.)
const UNSUBSCRIBED_REQUEST = BannerAdSize.inlineAdaptive({
  width: Dimensions.get('window').width - HORIZONTAL_INSET,
  maxHeight: 250,
});
const unsubscribedAd = createBannerAd({
  adUnitId: TEST_BANNER_UNIT_ID,
  size: UNSUBSCRIBED_REQUEST,
});

// The width available inside a card, derived the same analytic way as `preloadedAd` above.
const GALLERY_WIDTH = Dimensions.get('window').width - HORIZONTAL_INSET;

// The sizes manual QA had not covered yet: the five fixed sizes, plus inlineAdaptive with and
// without a maxHeight. FULL_BANNER (468dp) and LEADERBOARD (728dp) are wider than a phone
// screen on purpose — what a too-wide banner actually does is worth recording.
//
// Sizes are computed once at module scope; no ad is created until the card mounts.
const GALLERY_SIZES: { label: string; size: BannerAdSize }[] = [
  { label: 'BANNER', size: BannerAdSize.BANNER },
  { label: 'LARGE_BANNER', size: BannerAdSize.LARGE_BANNER },
  { label: 'MEDIUM_RECTANGLE', size: BannerAdSize.MEDIUM_RECTANGLE },
  { label: 'FULL_BANNER (wider than a phone)', size: BannerAdSize.FULL_BANNER },
  { label: 'LEADERBOARD (wider than a phone)', size: BannerAdSize.LEADERBOARD },
  // There is no "no maxHeight" row any more: `maxHeight` is required, because neither SDK's
  // no-max-height inline adaptive size survives the trip through `{width, height}` (iOS returns
  // height 0, Android the whole screen height). Two different maxHeights are exercised instead,
  // to show the reserved box tracking the max and `loadedSize` tracking what actually arrived.
  {
    label: 'inlineAdaptive (maxHeight 100)',
    size: BannerAdSize.inlineAdaptive({ width: GALLERY_WIDTH, maxHeight: 100 }),
  },
  {
    label: 'inlineAdaptive (maxHeight 250)',
    size: BannerAdSize.inlineAdaptive({ width: GALLERY_WIDTH, maxHeight: 250 }),
  },
  // The anchored kinds in every orientation the API offers. A size only stays adaptive across
  // the JS boundary if it carries the marker naming the exact factory it came from, orientation
  // included — these rows are what a device probe of the rebuilt ad size's flags is read from.
  {
    label: 'anchoredAdaptive (current)',
    size: BannerAdSize.anchoredAdaptive({ width: GALLERY_WIDTH }),
  },
  {
    label: 'anchoredAdaptive (portrait)',
    size: BannerAdSize.anchoredAdaptive({ width: GALLERY_WIDTH, orientation: 'portrait' }),
  },
  {
    label: 'anchoredAdaptive (landscape)',
    size: BannerAdSize.anchoredAdaptive({ width: GALLERY_WIDTH, orientation: 'landscape' }),
  },
  {
    label: 'largeAnchoredAdaptive (current)',
    size: BannerAdSize.largeAnchoredAdaptive({ width: GALLERY_WIDTH }),
  },
  {
    label: 'largeAnchoredAdaptive (portrait)',
    size: BannerAdSize.largeAnchoredAdaptive({ width: GALLERY_WIDTH, orientation: 'portrait' }),
  },
  {
    label: 'largeAnchoredAdaptive (landscape)',
    size: BannerAdSize.largeAnchoredAdaptive({ width: GALLERY_WIDTH, orientation: 'landscape' }),
  },
];

/**
 * One gallery entry. The red outline is the box `BannerAdView` reserves, so a banner that is
 * clipped, letterboxed, or overflowing its card shows up against it.
 */
function SizeCard({ label, size }: { label: string; size: BannerAdSize }) {
  const { ad, isLoaded, error, loadedSize } = useBannerAd({
    adUnitId: TEST_BANNER_UNIT_ID,
    size,
  });

  return (
    <View style={styles.card}>
      <Text>
        {label}: {isLoaded ? 'showing' : error ? `error ${error.code} ${error.message}` : 'loading'}
      </Text>
      <Text>
        requested {size.width}x{size.height} / loadedSize{' '}
        {loadedSize ? `${loadedSize.width}x${loadedSize.height}` : '-'} / card inner width{' '}
        {GALLERY_WIDTH}
      </Text>
      <View style={styles.outline}>
        <BannerAdView ad={ad} />
      </View>
    </View>
  );
}

/** Logs finer-grained ad events (impression/clicked/paid). The ad is an external system, so this syncs via useEffect. */
function useAdEventLog(ad: BannerAd, label: string) {
  useEffect(() => {
    const subscriptions = [
      ad.addListener('impression', () => console.log(`[QA] ${label}: impression`)),
      ad.addListener('clicked', () => console.log(`[QA] ${label}: clicked`)),
      ad.addListener('paid', (value) => console.log(`[QA] ${label}: paid`, value)),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [ad, label]);
}

function PreloadedBanner({ showDual }: { showDual: boolean }) {
  const { isLoaded, error, loadedSize } = useBannerAdState(preloadedAd);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  useAdEventLog(preloadedAd, 'preloaded');

  return (
    <View style={styles.card} onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
      <Text>Preloaded: {isLoaded ? 'showing' : error ? `failed ${error.message}` : 'loading'}</Text>
      <Text>
        Requested size: {preloadedAd.size.width}x{preloadedAd.size.height} / after load:{' '}
        {loadedSize ? `${loadedSize.width}x${loadedSize.height}` : '-'} / card inner width:{' '}
        {containerWidth != null ? containerWidth - CARD_PADDING : '-'}
      </Text>
      <BannerAdView ad={preloadedAd} />
      {showDual ? (
        <>
          <Text>Second View for the same ad (last one should win)</Text>
          <BannerAdView ad={preloadedAd} />
        </>
      ) : null}
    </View>
  );
}

/**
 * Renders a preloaded ad the way the README's preload example does: no `useBannerAdState`, no
 * state of its own. Two things are visible here:
 *   - whether anything re-renders when the ad finishes loading (the "loadedSize read at render"
 *     value stays `-` if `BannerAdView` never re-renders, which is also why it would keep using
 *     the requested size instead of `loadedSize`)
 *   - what happens when the ad is `release()`d while this View is still mounted
 */
function UnsubscribedBanner({ released }: { released: boolean }) {
  // Every property of a released ad throws, so the app itself has to stop reading them once it
  // has released one. `released` is the app's own record of having pressed the button.
  const loadedSize = released ? null : unsubscribedAd.loadedSize;

  return (
    <View style={styles.card}>
      <Text>
        Unsubscribed BannerAdView. Requested: {UNSUBSCRIBED_REQUEST.width}x
        {UNSUBSCRIBED_REQUEST.height} / loadedSize read at render:{' '}
        {released ? 'released' : loadedSize ? `${loadedSize.width}x${loadedSize.height}` : '-'}
      </Text>
      <View style={styles.outline}>
        <BannerAdView ad={unsubscribedAd} />
      </View>
    </View>
  );
}

/**
 * The hook-created banner creates the ad inside the View (i.e. after mount), so it can use
 * the "card inner width" measured via onLayout. It doesn't create the ad until the width is
 * known (before the first layout pass) — waiting for one real measurement avoids the wasted
 * load that would come from building with a guessed screen width and then rebuilding, and is
 * also the more natural choice in a real app.
 */
function HookCreatedBanner({
  useBadUnit,
  onToggleUnit,
}: {
  useBadUnit: boolean;
  onToggleUnit: () => void;
}) {
  const [width, setWidth] = useState<number | null>(null);

  const handleLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  return (
    <View style={styles.card}>
      {/* Kept inside the card so the ad's own status stays on screen while the unit is switched. */}
      <Button
        title={`Switch to a ${useBadUnit ? 'valid' : 'bad'} ad unit ID (recreates the ad)`}
        onPress={onToggleUnit}
      />
      <View onLayout={handleLayout}>
        {width != null ? <HookCreatedBannerContent useBadUnit={useBadUnit} width={width} /> : null}
      </View>
    </View>
  );
}

function HookCreatedBannerContent({ useBadUnit, width }: { useBadUnit: boolean; width: number }) {
  const size = useBannerAdSize({ type: 'anchoredAdaptive', width });
  const { ad, isLoaded, error } = useBannerAd({
    adUnitId: useBadUnit ? BAD_BANNER_UNIT_ID : TEST_BANNER_UNIT_ID,
    size,
  });
  useAdEventLog(ad, 'hook');

  // The state the hook reports is what decides whether the documented
  // `{isLoaded && <BannerAdView/>}` pattern renders anything, and the window where it can be
  // wrong (right after `useBannerAd` recreated the ad) is far too short to screenshot. Logging
  // it every render makes it checkable: the FIRST line after the ad unit or the size changes
  // must already describe the new ad, not the old one.
  //
  // Render passes are logged as well as commits, because `useBannerAdState` resets its state
  // during render (React's own pattern for "state derived from a prop that changed"), and React
  // runs the component once more and throws the first pass away. That discarded pass does log
  // the stale value, so only the COMMIT lines say what was actually shown.
  console.log(
    `[QA] hook render: unit=${useBadUnit ? 'bad' : 'valid'} size=${size.width}x${size.height} ` +
      `isLoaded=${isLoaded} error=${error?.code ?? '-'}`
  );
  useEffect(() => {
    console.log(
      `[QA] hook COMMIT: unit=${useBadUnit ? 'bad' : 'valid'} size=${size.width}x${size.height} ` +
        `isLoaded=${isLoaded} error=${error?.code ?? '-'}`
    );
  });

  return (
    <>
      <Text>
        Hook-created (legacy adaptive {size.width}x{size.height}, container width {width}):{' '}
        {isLoaded ? 'showing' : 'loading'}
      </Text>
      {error ? (
        <Text>
          Error: {error.message} / responseInfo: {error.responseInfo ? 'present' : 'absent'}
        </Text>
      ) : null}
      <BannerAdView ad={ad} />
    </>
  );
}

export default function App() {
  const [screen, setScreen] = useState<'a' | 'b'>('a');
  const [remountKey, setRemountKey] = useState(0);
  const [showDual, setShowDual] = useState(false);
  const [useBadUnit, setUseBadUnit] = useState(false);
  const [showHookBanner, setShowHookBanner] = useState(true);
  const [renderCount, setRenderCount] = useState(0);
  const [unsubscribedReleased, setUnsubscribedReleased] = useState(false);
  const [showGallery, setShowGallery] = useState(false);

  // The gallery replaces the rest of the screen rather than sitting under it: seven more
  // banners below ten buttons is unreadable, and each size needs to be seen in a card of its
  // own to judge whether it fits.
  if (showGallery) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Button title="Back to the main QA screen" onPress={() => setShowGallery(false)} />
          {GALLERY_SIZES.map(({ label, size }) => (
            <SizeCard key={label} label={label} size={size} />
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Button title="Show the banner size gallery" onPress={() => setShowGallery(true)} />
        <Button
          title={`Switch screen (current: ${screen}) - reuse test`}
          onPress={() => setScreen((s) => (s === 'a' ? 'b' : 'a'))}
        />
        <Button
          title="Force-recreate screen A (real unmount test)"
          onPress={() => setRemountKey((k) => k + 1)}
        />
        <Button
          title={`${showDual ? 'Remove' : 'Add'} a second View for the same ad`}
          onPress={() => setShowDual((v) => !v)}
        />
        <Button
          title={`${showHookBanner ? 'Hide' : 'Show'} the hook-created banner (unmount test)`}
          onPress={() => setShowHookBanner((v) => !v)}
        />
        <Button
          title={`Re-render only (count: ${renderCount})`}
          onPress={() => setRenderCount((c) => c + 1)}
        />
        <Button
          title="Release the unsubscribed ad while its View is mounted"
          onPress={() => {
            unsubscribedAd.release();
            setUnsubscribedReleased(true);
            setRenderCount((c) => c + 1);
          }}
        />

        {screen === 'a' ? (
          <PreloadedBanner key={remountKey} showDual={showDual} />
        ) : (
          <Text>Screen B (no ad)</Text>
        )}
        {showHookBanner ? <HookCreatedBanner useBadUnit={useBadUnit} onToggleUnit={() => setUseBadUnit((v) => !v)} /> : <Text>(hidden)</Text>}
        <UnsubscribedBanner released={unsubscribedReleased} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // react-native's SafeAreaView is a no-op on Android (it's an iOS-only implementation), so
  // without explicitly adding status-bar-height padding here, the first button renders behind
  // the status bar's touch-intercepting area and never receives taps (hit this on a real device).
  container: {
    flex: 1,
    backgroundColor: '#eee',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0,
  },
  content: { gap: 24, padding: 16 },
  card: { gap: 8, backgroundColor: '#fff', borderRadius: 10, padding: 16 },
  // Makes the box BannerAdView actually reserves visible, so a banner that stays at its
  // requested size after loading a smaller one shows up as letterboxing.
  outline: { borderWidth: 1, borderColor: '#f00' },
});
