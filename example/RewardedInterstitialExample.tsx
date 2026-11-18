import { useEventListener } from 'expo';
import { useState } from 'react';
import { Button, Platform, Text, View } from 'react-native';
import { useRewardedInterstitialAd, type AdReward } from '@kazutoyo/expo-google-mobile-ads';

const adUnitId =
  Platform.OS === 'ios'
    ? 'ca-app-pub-3940256099942544/6978759866'
    : 'ca-app-pub-3940256099942544/5354046379';

function AdInstance({ onSkip }: { onSkip: () => void }) {
  const { ad, isLoaded, error } = useRewardedInterstitialAd({ adUnitId });
  const [result, setResult] = useState('');
  const [earnedReward, setEarnedReward] = useState<AdReward | null>(null);
  // This is the sole place to grant a reward. It also handles an adapter's late callback;
  // the dismissal result below is only presentation status, never a second grant path.
  useEventListener(ad, 'earnedReward', (reward) => setEarnedReward(reward));
  return (
    <View style={{ gap: 8 }}>
      <Text>Rewarded interstitial</Text>
      {error && <Text>{error.message}</Text>}
      {isLoaded && (
        <View>
          <Text>
            Watch this ad to earn {ad.reward?.amount} {ad.reward?.type}.
          </Text>
          <Button title="Skip ad" onPress={onSkip} />
        </View>
      )}
      <Button
        title="Show ad"
        disabled={!isLoaded}
        onPress={async () => {
          try {
            const rewardAtDismissal = await ad.show();
            setResult(
              rewardAtDismissal
                ? 'Dismissed after reward callback'
                : 'Dismissed (no reward received yet)'
            );
          } catch (error) {
            setResult(String(error));
          }
        }}
      />
      <Text>{result}</Text>
      <Text>
        {earnedReward
          ? `Earned reward: ${JSON.stringify(earnedReward)}`
          : 'No reward event received'}
      </Text>
    </View>
  );
}

export default function RewardedInterstitialExample() {
  const [key, setKey] = useState(0);
  const [visible, setVisible] = useState(false);
  return (
    <View style={{ gap: 8, padding: 16, backgroundColor: 'white' }}>
      <Button title="Rewarded interstitial: load / skip" onPress={() => setVisible((v) => !v)} />
      <Button
        title="Create a fresh ad"
        onPress={() => {
          setKey((k) => k + 1);
          setVisible(true);
        }}
      />
      {visible && <AdInstance key={key} onSkip={() => setVisible(false)} />}
    </View>
  );
}
