---
title: リワードインタースティシャル広告
---

# リワードインタースティシャル広告

同意を取得し、`initialize()` を呼び出してから広告をロードします。

```tsx
import { useEventListener } from 'expo';
import { Platform } from 'react-native';
import { useRewardedInterstitialAd } from '@kazutoyo/expo-google-mobile-ads';

const adUnitId = Platform.select({
  android: 'ca-app-pub-3940256099942544/5354046379',
  ios: 'ca-app-pub-3940256099942544/6978759866',
})!;

const { ad, isLoaded, error } = useRewardedInterstitialAd({ adUnitId });
// Subscribe before showing; grant only from this event, including late mediated callbacks.
useEventListener(ad, 'earnedReward', (reward) => grantReward(reward));
// Call from your introduction screen's continue action, only when ready.
if (isLoaded) {
  await ad.show(); // Dismissal; do not grant a second reward from the returned value.
}
```

表示前に、報酬の説明と広告をスキップする選択肢を含む案内画面をアプリ側で表示してください。その後に `show()` を呼びます。案内画面自体はライブラリに含まれません。

`ad.reward` は視聴前に提示する報酬です。獲得した証拠ではありません。報酬の付与には、表示前に登録した `earnedReward` イベントだけを使ってください。`show()` の戻り値からも付与すると二重付与になります。

`show()` は広告を閉じると、その時点までに受け取った報酬、または `null` を返します。iOS のメディエーションでは、第三者 SDK の通知順序によって、報酬イベントが広告を閉じた後に届く場合があります。そのため `null` を報酬未獲得の最終判定に使わないでください。`show()` が解決したという理由だけで広告や購読を解放せず、アダプターの報酬通知を受け取れる間は保持してください。実際の順序は使用するアダプターで検証が必要です。

広告は一度だけ表示できます。サーバーサイド検証（SSV）は未対応です。通知順序の背景は [Google の iOS リワード FAQ](https://developers.google.com/admob/ios/rewarded#faq) を参照してください。

## API

- `createRewardedInterstitialAd({ adUnitId, requestOptions? })`: preload outside React; call `release()` when finished.
- `useRewardedInterstitialAd(options)`: creates and releases the ad; `requestOptions` is read at creation time.
- `useRewardedInterstitialAdState(ad)`: subscribes without owning or releasing the ad.
- `ad.load()`: retry or reload before presentation.
- `ad.status`, `ad.error`, `ad.responseInfo`: current load state and diagnostics.
- Events: `statusChange`, `impression`, `clicked`, `paid`, `showed`, `dismissed`, `earnedReward`.

[Google integration guide](https://developers.google.com/admob/ios/rewarded-interstitial)
