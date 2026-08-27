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

// Initialize on app start and preload an ad outside of React.
//
// When testing the "initialization order" QA items, edit this by hand:
//   - comment it out to check that the __DEV__ warning fires
//   - wrap it in `setTimeout(() => initialize()..., 5000)` to check it still loads after the delay
initialize().then((status) => console.log('[QA] initialize() resolved', status));

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
 * The hook-created banner creates the ad inside the View (i.e. after mount), so it can use
 * the "card inner width" measured via onLayout. It doesn't create the ad until the width is
 * known (before the first layout pass) — waiting for one real measurement avoids the wasted
 * load that would come from building with a guessed screen width and then rebuilding, and is
 * also the more natural choice in a real app.
 */
function HookCreatedBanner({ useBadUnit }: { useBadUnit: boolean }) {
  const [width, setWidth] = useState<number | null>(null);

  const handleLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  return (
    <View style={styles.card}>
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
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
          title={`Switch hook-created banner to a ${useBadUnit ? 'valid' : 'bad'} ad unit ID`}
          onPress={() => setUseBadUnit((v) => !v)}
        />

        {screen === 'a' ? (
          <PreloadedBanner key={remountKey} showDual={showDual} />
        ) : (
          <Text>Screen B (no ad)</Text>
        )}
        <HookCreatedBanner useBadUnit={useBadUnit} />
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
});
