import { useState } from 'react';
import { Button, Modal, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  SwipeableInterstitialAdView,
  useSwipeableInterstitialAd,
} from '@kazutoyo/expo-google-mobile-ads';

function AdPage({ adUnitId, onClose }: { adUnitId: string; onClose: () => void }) {
  // Default maxScreenHoldDuration is 0, so this example may close immediately.
  const { ad, isLoaded, error, minScreenHoldDuration } = useSwipeableInterstitialAd({ adUnitId });
  return (
    <View style={{ flex: 1 }}>
      <SwipeableInterstitialAdView ad={ad} style={StyleSheet.absoluteFill} />
      <SafeAreaView pointerEvents="box-none">
        <Button testID="swipeable-close" title="Close swipeable interstitial" onPress={onClose} />
        <Text testID="swipeable-status">
          {error
            ? `Error: ${error.message}`
            : isLoaded
              ? `Loaded (hold: ${minScreenHoldDuration}s)`
              : 'Loading swipeable interstitial…'}
        </Text>
        <Button
          testID="swipeable-reload"
          title="Reload swipeable interstitial"
          onPress={() => ad.load()}
        />
      </SafeAreaView>
    </View>
  );
}

export function SwipeableInterstitialExample() {
  const [adUnitId, setAdUnitId] = useState('');
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Text>Swipeable interstitial (view-based)</Text>
      <TextInput
        testID="swipeable-unit-input"
        accessibilityLabel="Swipeable interstitial ad unit ID"
        placeholder="Your swipeable interstitial ad unit ID"
        value={adUnitId}
        onChangeText={setAdUnitId}
        autoCapitalize="none"
        autoCorrect={false}
        style={{ borderWidth: 1, padding: 8 }}
      />
      <Button
        testID="swipeable-open"
        title="Open swipeable interstitial"
        disabled={!adUnitId.trim()}
        onPress={() => setOpen(true)}
      />
      <Modal visible={open} presentationStyle="fullScreen" onRequestClose={() => setOpen(false)}>
        {open && <AdPage adUnitId={adUnitId.trim()} onClose={() => setOpen(false)} />}
      </Modal>
    </View>
  );
}
