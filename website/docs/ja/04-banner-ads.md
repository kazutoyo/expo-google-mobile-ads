---
title: "バナー広告"
description: "React の外でバナーをプリロードして、画面に取り付け、状態を購読します。"
---

## プリロード

広告インスタンスの生成（＝ロード開始）と画面への表示は独立しています。次の画面へ遷移する前でも、アプリ起動時でも、広告だけ先に作っておけます。

```typescript
// 例: モジュールスコープ、または画面遷移前のどこかで
import { createBannerAd, BannerAdSize } from '@kazutoyo/expo-google-mobile-ads';

export const homeBannerAd = createBannerAd({
  adUnitId: 'ca-app-pub-3940256099942544/9214589741',
  size: BannerAdSize.BANNER,
});
```

```tsx
// 画面コンポーネント側
import { useBannerAdState, BannerAdView } from '@kazutoyo/expo-google-mobile-ads';
import { homeBannerAd } from './ads';

function HomeScreen() {
  const { isLoaded } = useBannerAdState(homeBannerAd);

  return <BannerAdView ad={homeBannerAd} />;
}
```

`<BannerAdView>` はマウント時にネイティブ View をアタッチし、**アンマウント時はデタッチするだけ**で広告そのものは破棄しません。画面から離れて戻ってきても、再ロードなしに同じ広告が表示されます。明示的に破棄したい場合は `ad.release()` を呼んでください。

## hooks

2つの hook は、広告のライフタイムをどこまで持つかが違います。

| hook | 広告を生成するか | アンマウント時に release するか |
|---|---|---|
| `useBannerAd(options)` | する | **する** |
| `useBannerAdState(ad)` | しない（既存の `ad` を購読） | **しない** |

広告のライフタイムが画面と一致するなら（プリロードしないなら）`useBannerAd` で十分かと思います。

```tsx
import { useBannerAd, BannerAdSize, BannerAdView } from '@kazutoyo/expo-google-mobile-ads';

function Screen() {
  const { ad, isLoaded, error } = useBannerAd({
    adUnitId: 'ca-app-pub-3940256099942544/9214589741',
    size: BannerAdSize.BANNER,
  });

  return <BannerAdView ad={ad} />;
}
```

プリロード済みの広告を画面に出すだけなら `useBannerAdState` を使います（前節の例）。生成も release もしないので、`ad` のライフタイムは呼び出し側が持つことになります。

もっと細かい状態変化（インプレッション、クリック、収益イベントなど）は `ad.addListener(...)` で直接購読できます。

```typescript
const subscription = ad.addListener('statusChange', ({ status }) => {
  if (status === 'loaded') {
    // ...
  }
});
```

## バナーの自動リフレッシュ

GMA のバナー自動リフレッシュは **AdMob 管理画面（広告ユニットごとの設定）の機能で、SDK の API ではありません**。このライブラリは一切関与しません。間隔を変えたい場合は AdMob の管理画面で設定してください。
