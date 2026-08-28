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
  ShowAdError,
  createBannerAd,
  createInterstitialAd,
  createRewardedAd,
  initialize,
  useBannerAd,
  useBannerAdSize,
  useBannerAdState,
  useInterstitialAd,
  useRewardedAd,
  type BannerAd,
  type InterstitialAd,
  type RewardedAd,
} from 'expo-google-mobile-ads';

const TEST_BANNER_UNIT_ID = 'ca-app-pub-3940256099942544/9214589741';
const TEST_INTERSTITIAL_UNIT_ID = 'ca-app-pub-3940256099942544/1033173712';
const TEST_REWARDED_UNIT_ID = 'ca-app-pub-3940256099942544/5224354917';
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

// ---------------------------------------------------------------------------
// Full-screen ads (interstitial / rewarded)
// ---------------------------------------------------------------------------

// Created outside React, at module scope, immediately after `initialize()` was *called* — so
// with INITIALIZE_DELAY_MS set to 5000 these are the "created before initialize() resolved"
// case: they must stay on `loading` for the whole delay and then load by themselves.
const preloadedInterstitial = createInterstitialAd({ adUnitId: TEST_INTERSTITIAL_UNIT_ID });
const preloadedRewarded = createRewardedAd({ adUnitId: TEST_REWARDED_UNIT_ID });

// A separate ad used only for the "a load lands during/after a presentation" check, so the
// other cards keep a clean, readable status history.
const overlappingLoadAd = createInterstitialAd({ adUnitId: TEST_INTERSTITIAL_UNIT_ID });

// A plain module-scope log. The interesting beats (events, promise settlement) happen outside
// React and outside any component that is necessarily mounted, so the log cannot live in
// component state. Every line also goes to the console, which is what `adb logcat` /
// the iOS simulator log show.
const logLines: string[] = [];
const logListeners = new Set<() => void>();

function qaLog(line: string) {
  // The timestamp is part of the console line too: on iOS these never reach the system log,
  // so the Metro console is the only timestamped record of when each beat happened.
  const stamped = `${new Date().toISOString().slice(11, 23)} ${line}`;
  console.log(`[QA] ${stamped}`);
  logLines.unshift(stamped);
  if (logLines.length > 60) logLines.pop();
  logListeners.forEach((listener) => listener());
}

/** Subscribes the screen to `qaLog`. The log is an external store, hence the effect. */
function useQaLog(): string[] {
  const [, forceRender] = useState(0);
  useEffect(() => {
    const listener = () => forceRender((c) => c + 1);
    logListeners.add(listener);
    return () => {
      logListeners.delete(listener);
    };
  }, []);
  return logLines;
}

/** A released ad throws from every getter, so status is read defensively. */
function readStatus(ad: InterstitialAd | RewardedAd): string {
  try {
    return ad.status;
  } catch {
    return 'released';
  }
}

function responseId(ad: InterstitialAd | RewardedAd): string {
  try {
    return ad.responseInfo?.responseId ?? '-';
  } catch {
    return 'released';
  }
}

/**
 * Logs every event the ad emits and tracks its `status` for display.
 *
 * `status` is also re-read right after subscribing: the ad is an external system that can have
 * moved on between the first render and the effect.
 */
function useFullScreenAdLog(ad: InterstitialAd | RewardedAd, label: string): string {
  const [status, setStatus] = useState(() => readStatus(ad));

  useEffect(() => {
    // `RewardedAdEvents` is a superset of `FullScreenAdEvents`, but the union of the two ad types
    // has two incompatible `addListener` signatures, so the listeners are attached through the
    // wider one. `earnedReward` is still only subscribed to when the ad really is rewarded.
    const listenable = ad as RewardedAd;
    const subscriptions = [
      listenable.addListener('statusChange', ({ status: next, error }) => {
        setStatus(next);
        qaLog(
          `${label}: status -> ${next}${error ? ` error=${error.code} ${error.message}` : ''}` +
            ` responseId=${responseId(ad)}`
        );
      }),
      listenable.addListener('showed', () => qaLog(`${label}: showed`)),
      listenable.addListener('dismissed', () => qaLog(`${label}: dismissed`)),
      listenable.addListener('impression', () => qaLog(`${label}: impression`)),
      listenable.addListener('clicked', () => qaLog(`${label}: clicked`)),
      listenable.addListener('paid', (value) =>
        qaLog(`${label}: paid ${value.value} ${value.currencyCode} (${value.precision})`)
      ),
    ];
    if ('reward' in ad) {
      subscriptions.push(
        listenable.addListener('earnedReward', (reward) =>
          qaLog(`${label}: earnedReward ${reward.type} x${reward.amount}`)
        )
      );
    }
    setStatus(readStatus(ad));
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [ad, label]);

  return status;
}

/** Calls `show()` and logs exactly how the promise settled, which is the whole point of the QA. */
async function runShow(label: string, show: () => Promise<unknown>) {
  qaLog(`${label}: show() called`);
  try {
    const result = await show();
    qaLog(
      `${label}: show() RESOLVED with ${result === undefined ? 'undefined' : JSON.stringify(result)}`
    );
  } catch (error) {
    const code = error instanceof ShowAdError ? error.code : `(not a ShowAdError: ${typeof error})`;
    qaLog(`${label}: show() REJECTED code=${code} message=${(error as Error).message}`);
  }
}

/** One ad's status line. Rewarded ads also show the *offered* reward. */
function AdStatusCard({
  ad,
  label,
  onShow,
}: {
  ad: InterstitialAd | RewardedAd;
  label: string;
  onShow: () => void;
}) {
  const status = useFullScreenAdLog(ad, label);
  const isRewarded = 'reward' in ad;
  // Read during render, on purpose: the point is that it is readable *before* showing.
  let offered = '-';
  if (isRewarded) {
    try {
      const reward = (ad as RewardedAd).reward;
      offered = reward ? `${reward.type} x${reward.amount}` : 'none yet';
    } catch {
      offered = 'released';
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.bold}>
        {label}: status={status}
      </Text>
      {isRewarded ? (
        <Text>
          Offered reward (what the ad OFFERS — NOT earned, and not proof of anything earned):{' '}
          {offered}
        </Text>
      ) : null}
      <Button title={`Show ${label}`} onPress={onShow} />
    </View>
  );
}

/**
 * The full-screen QA screen. Every button maps to a numbered item in `example/QA.md`.
 */
function FullScreenSection({ onBack }: { onBack: () => void }) {
  const lines = useQaLog();
  const hookInterstitial = useInterstitialAd({ adUnitId: TEST_INTERSTITIAL_UNIT_ID });
  const hookRewarded = useRewardedAd({ adUnitId: TEST_REWARDED_UNIT_ID });
  const overlappingStatus = useFullScreenAdLog(overlappingLoadAd, 'overlap');

  // Item 3: an ad that has had no time at all to load. Created and shown in the same tick.
  const handleShowStillLoading = () => {
    const fresh = createInterstitialAd({ adUnitId: TEST_INTERSTITIAL_UNIT_ID });
    qaLog(`fresh: created, status=${readStatus(fresh)}`);
    runShow('fresh (expect notLoaded)', () => fresh.show()).then(() => fresh.release());
  };

  // Item 8: `load()` on a shown ad must change nothing. The status is logged now and again
  // after a delay, so a late load result would show up.
  const handleReloadShown = () => {
    qaLog(`reload-shown: status before load() = ${readStatus(preloadedInterstitial)}`);
    preloadedInterstitial.load();
    setTimeout(
      () =>
        qaLog(
          `reload-shown: status 3s after load() = ${readStatus(preloadedInterstitial)}` +
            ` responseId=${responseId(preloadedInterstitial)}`
        ),
      3000
    );
  };

  // Item B: force an overlapping load result to be discarded rather than recorded.
  //
  // A second `load()` cannot be started while a show is in flight (`load()` refuses), so the
  // second request has to be issued *before* the show. Two loads are started 150ms apart —
  // shorter than a real load takes — and the ad is shown the instant one of them lands, from the
  // statusChange handler itself.
  //
  // **Two different guards can fire here, and which one does depends on delivery order.** The
  // second `load()` supersedes the first, so if the first request's result arrives after that it
  // is discarded as stale (`isStaleLoadResult`) — before the presentation, which is why the ad
  // that gets shown is the second request's. If instead a result arrives while the ad is on
  // screen, `shouldDiscardLoadResult` catches it. Both log a line at debug level saying which.
  //
  // What proves a guard held, whichever one fired: the presenting ad still dismisses, `show()`
  // still resolves, `status` stays `shown` with NO further statusChange, and
  // `responseInfo.responseId` is unchanged after dismissal (an installed result would have
  // replaced it).
  const handleOverlappingLoad = () => {
    qaLog(
      `overlap: arming. status=${readStatus(overlappingLoadAd)} responseId=${responseId(overlappingLoadAd)}`
    );
    const subscription = overlappingLoadAd.addListener('statusChange', ({ status }) => {
      if (status !== 'loaded') return;
      subscription.remove();
      qaLog(`overlap: first load landed (responseId=${responseId(overlappingLoadAd)}), showing now`);
      runShow('overlap', () => overlappingLoadAd.show()).then(() => {
        qaLog(
          `overlap: after dismissal status=${readStatus(overlappingLoadAd)}` +
            ` responseId=${responseId(overlappingLoadAd)}`
        );
        setTimeout(
          () =>
            qaLog(
              `overlap: 5s after dismissal status=${readStatus(overlappingLoadAd)}` +
                ` responseId=${responseId(overlappingLoadAd)}`
            ),
          5000
        );
      });
    });
    overlappingLoadAd.load();
    setTimeout(() => {
      qaLog('overlap: issuing the second load()');
      overlappingLoadAd.load();
    }, 150);
  };

  // Item C: a real presentation failure. Both `show()` calls pass the JS `status === 'loaded'`
  // gate (the status only becomes `shown` once the SDK reports the presentation), so the second
  // one reaches native and is rejected there as "already presenting" — which `show()` maps to
  // `failedToShow`. The first must still resolve normally on dismissal.
  const handleDoubleShow = () => {
    runShow('double-show #1', () => hookInterstitial.ad.show());
    runShow('double-show #2 (expect failedToShow)', () => hookInterstitial.ad.show());
  };

  // Item C, second route: call the internal `showAsync()` on an already-shown ad, bypassing the
  // JS guard, so the SDK itself refuses the presentation (AdAlreadyUsed / AD_REUSED). Proves the
  // native failure callback settles the promise instead of leaving it pending.
  const handleForceSdkPresentFailure = () => {
    qaLog(`sdk-fail: status=${readStatus(preloadedInterstitial)}, calling showAsync() directly`);
    preloadedInterstitial.showAsync().then(
      () => qaLog('sdk-fail: showAsync() RESOLVED (no presentation failure)'),
      (error: Error) => qaLog(`sdk-fail: showAsync() REJECTED ${error.message}`)
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Button title="Back to the main QA screen" onPress={onBack} />
        <Text style={styles.bold}>
          Full-screen ads. Watch a rewarded ad to the end for a reward; close it early to check
          that no reward is granted.
        </Text>

        <AdStatusCard
          ad={preloadedInterstitial}
          label="preloaded interstitial"
          onShow={() => runShow('preloaded interstitial', () => preloadedInterstitial.show())}
        />
        <AdStatusCard
          ad={hookInterstitial.ad}
          label="hook interstitial"
          onShow={() => runShow('hook interstitial', () => hookInterstitial.ad.show())}
        />
        <AdStatusCard
          ad={preloadedRewarded}
          label="preloaded rewarded"
          onShow={() => runShow('preloaded rewarded', () => preloadedRewarded.show())}
        />
        <AdStatusCard
          ad={hookRewarded.ad}
          label="hook rewarded"
          onShow={() => runShow('hook rewarded', () => hookRewarded.ad.show())}
        />

        <View style={styles.card}>
          <Text style={styles.bold}>Failure and guard cases</Text>
          <Button
            title="Show an ad that is still loading (expect notLoaded)"
            onPress={handleShowStillLoading}
          />
          <Button
            title="Show the preloaded interstitial again (expect alreadyShown)"
            onPress={() => runShow('already-shown', () => preloadedInterstitial.show())}
          />
          <Button title="load() on the shown interstitial (expect no-op)" onPress={handleReloadShown} />
          <Button
            title={`Overlapping load during a presentation (status=${overlappingStatus})`}
            onPress={handleOverlappingLoad}
          />
          <Button
            title={`show() twice in one tick (expect the 2nd to reject failedToShow)${
              hookInterstitial.isLoaded ? '' : ' — waiting for the hook interstitial to load'
            }`}
            onPress={handleDoubleShow}
            // Disabled until the ad is loaded, because otherwise this button does not test what it
            // claims: `assertShowable` would reject BOTH calls with `notLoaded` in JS, neither one
            // would reach native, and the native `failedToShow` path the button exists to exercise
            // would never run. QA item C-1 reads this button as evidence for that path.
            disabled={!hookInterstitial.isLoaded}
          />
          <Button
            title="Force an SDK presentation failure on a shown ad"
            onPress={handleForceSdkPresentFailure}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.bold}>Log (newest first)</Text>
          {lines.map((line, index) => (
            <Text key={`${index}-${line}`} style={styles.log}>
              {line}
            </Text>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
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
  const [showFullScreen, setShowFullScreen] = useState(false);

  // Full-screen ads have no view, so this screen is a list of buttons and a log rather than a
  // gallery. It replaces the rest of the screen for the same reason the gallery does.
  if (showFullScreen) {
    return <FullScreenSection onBack={() => setShowFullScreen(false)} />;
  }

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
          title="Show the full-screen ad QA screen"
          onPress={() => setShowFullScreen(true)}
        />
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
  bold: { fontWeight: 'bold' },
  log: { fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
});
