---
title: アプリ起動時広告
---

# アプリ起動時広告

同意を取得し、`initialize()` を呼び出してから広告をロードします。

```tsx
import { Platform } from 'react-native';
import { useAppOpenAd } from '@kazutoyo/expo-google-mobile-ads';

const adUnitId = Platform.select({
  android: 'ca-app-pub-3940256099942544/9257395921',
  ios: 'ca-app-pub-3940256099942544/5575463023',
})!;

const { ad, isLoaded, error } = useAppOpenAd({ adUnitId });
// Call from your app's chosen placement, only when ready.
if (isLoaded) {
  await ad.show();
  // The promise resolves when the ad is dismissed.
}
```

ロード画面やフォアグラウンドへの復帰処理から、準備完了を確認して `show()` を呼びます。ライブラリは AppState の監視や起動時の自動表示を行いません。ロードが間に合わなければ、その表示機会はスキップしてください。

ロード後4時間で期限切れになります。両 OS で期限切れ広告の表示を拒否し、JS のチェックでは `code: 'notLoaded'` の `ShowAdError` となります。`ad.status` は `error` を返します。期限切れタイマーで状態変更を通知し、hooks にも反映します。経過時間にはスリープ中も進む単調時計（iOS は ContinuousClock、Android は elapsedRealtime）を使います。復帰時にも再確認し、スリープでタイマーが遅れていても状態を更新して statusChange を通知します。状態の読み取り時と表示直前にも期限を確認します。`show()` の reject も処理してください。未使用の期限切れ広告は再ロードまたは作り直します。表示後は再利用できないため、次の表示には新しい広告を作ります。

## API

- `createAppOpenAd({ adUnitId, requestOptions? })`: preload outside React; call `release()` when finished.
- `useAppOpenAd(options)`: creates and releases the ad; `requestOptions` is read at creation time.
- `useAppOpenAdState(ad)`: subscribes without owning or releasing the ad.
- `ad.load()`: retry or reload before presentation.
- `ad.status`, `ad.error`, `ad.responseInfo`: current load state and diagnostics.
- Events: `statusChange`, `impression`, `clicked`, `paid`, `showed`, `dismissed`.

[Google integration guide](https://developers.google.com/admob/ios/app-open)
