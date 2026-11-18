import { useState } from 'react';
import { Button, Platform, Text, View } from 'react-native';
import { useNativeAd, NativeAdView } from '@kazutoyo/expo-google-mobile-ads';

const adUnitId =
  Platform.OS === 'ios'
    ? 'ca-app-pub-3940256099942544/3986624511'
    : 'ca-app-pub-3940256099942544/2247696110';

function AdInstance() {
  const { ad, isLoaded, error } = useNativeAd({ adUnitId });
  const [result, setResult] = useState('');
  const [visible, setVisible] = useState(true);
  return (
    <View style={{ gap: 8 }}>
      <Text>Native card: {isLoaded ? 'loaded' : 'not loaded'}</Text>
      {error && <Text>{error.message}</Text>}
      <Button title="Toggle card attachment" onPress={() => setVisible((v) => !v)} />
      <Button title="Reload" onPress={() => ad.load()} />
      <Button
        title="Release"
        onPress={() => {
          ad.release();
          setVisible(false);
          setResult('Released');
        }}
      />
      <Text>{result}</Text>
      {visible && isLoaded && <NativeAdView ad={ad} style={{ height: 360 }} />}
    </View>
  );
}

export default function NativeExample() {
  const [key, setKey] = useState(0);
  const [visible, setVisible] = useState(false);
  return (
    <View style={{ gap: 8, padding: 16, backgroundColor: 'white' }}>
      <Button title="Native card: load / unmount" onPress={() => setVisible((v) => !v)} />
      <Button
        title="Create a fresh ad"
        onPress={() => {
          setKey((k) => k + 1);
          setVisible(true);
        }}
      />
      {visible && <AdInstance key={key} />}
    </View>
  );
}
