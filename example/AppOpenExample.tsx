import { useState } from 'react';
import { Button, Platform, Text, View } from 'react-native';
import { useAppOpenAd } from '@kazutoyo/expo-google-mobile-ads';

const adUnitId =
  Platform.OS === 'ios'
    ? 'ca-app-pub-3940256099942544/5575463023'
    : 'ca-app-pub-3940256099942544/9257395921';

function AdInstance() {
  const { ad, isLoaded, error } = useAppOpenAd({ adUnitId });
  const [result, setResult] = useState('');
  return (
    <View style={{ gap: 8 }}>
      <Text>App open</Text>
      {error && <Text>{error.message}</Text>}
      <Text>Manual QA placement. Integrate with your app loading screen in production.</Text>
      <Button
        title="Show ad"
        disabled={!isLoaded}
        onPress={async () => {
          try {
            setResult(JSON.stringify(await ad.show()) ?? 'Dismissed');
          } catch (error) {
            setResult(String(error));
          }
        }}
      />
      <Text>{result}</Text>
    </View>
  );
}

export default function AppOpenExample() {
  const [key, setKey] = useState(0);
  const [visible, setVisible] = useState(false);
  return (
    <View style={{ gap: 8, padding: 16, backgroundColor: 'white' }}>
      <Button title="App open: load / unmount" onPress={() => setVisible((v) => !v)} />
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
