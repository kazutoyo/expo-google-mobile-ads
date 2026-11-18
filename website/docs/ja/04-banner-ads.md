---
title: "バナー広告"
description: "React の外でバナーをプリロードし、画面に取り付けて、状態を購読します。"
---

## プリロード

広告インスタンスの生成（＝ロードの開始）と、画面への表示は独立しています。アプリの起動時でも、次の画面へ遷移する前でも、広告だけ先に作れます。

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

`<BannerAdView>` はマウント時にネイティブ View をアタッチします。**アンマウント時はデタッチするだけ**で、広告そのものは破棄しません。画面から離れて戻ってきても、再ロードせずに同じ広告を表示します。明示的に破棄する場合は `ad.release()` を呼んでください。

## hooks

2つの hook は、広告のライフタイムを誰が持つかが違います。

| hook | 広告を生成するか | アンマウント時に release するか |
|---|---|---|
| `useBannerAd(options)` | する | **する** |
| `useBannerAdState(ad)` | しない（既存の `ad` を購読） | **しない** |

プリロードせず、広告のライフタイムが画面と一致するなら `useBannerAd` を使います。

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

プリロード済みの広告を画面に表示するだけなら `useBannerAdState` を使います（前節の例）。生成も release もしないため、`ad` のライフタイムは呼び出し側が持ちます。

より細かい状態変化（インプレッション、クリック、収益イベントなど）は、`ad.addListener(...)` で直接購読します。

```typescript
const subscription = ad.addListener('statusChange', ({ status }) => {
  if (status === 'loaded') {
    // ...
  }
});
```

## バナーの自動リフレッシュ

GMA のバナー自動リフレッシュは、**AdMob 管理画面の機能（広告ユニットごとの設定）であり、SDK の API ではありません**。このライブラリは関与しません。間隔を変更する場合は、AdMob の管理画面で設定してください。
