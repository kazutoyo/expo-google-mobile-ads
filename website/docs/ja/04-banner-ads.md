---
title: "バナー広告"
description: "React の外でバナーをプリロードし、画面に取り付け、状態を購読する。"
---

## プリロード

広告インスタンスの生成（＝ロード開始）と、画面への表示は独立している。次の画面へ遷移する前や、アプリ起動時に広告を作っておける。

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

`<BannerAdView>` はマウント時にネイティブ View をアタッチし、**アンマウント時はデタッチのみ**を行って広告そのものは破棄しない。この画面から離れて戻ってきても、再ロードなしに同じ広告を表示できる。広告を明示的に破棄したい場合は `ad.release()` を呼ぶ。

## hooks

2つの hook はそれぞれ広告のライフタイムに対する責務が異なる。

| hook | 広告を生成するか | アンマウント時に release するか |
|---|---|---|
| `useBannerAd(options)` | する | **する** |
| `useBannerAdState(ad)` | しない（既存の `ad` を購読） | **しない** |

画面と広告のライフタイムが一致する（プリロードしない）単純なケースでは `useBannerAd` を使う。

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

プリロード済みの広告を画面で使うだけの場合は `useBannerAdState` を使う（前節の例を参照）。この hook は `ad` の生成も release も行わない。呼び出し側が `ad` のライフタイムを管理する。

より詳細な状態変化（インプレッション、クリック、収益イベントなど）を購読したい場合は `ad.addListener(...)` を直接使う。

```typescript
const subscription = ad.addListener('statusChange', ({ status }) => {
  if (status === 'loaded') {
    // ...
  }
});
```

## バナーの自動リフレッシュ

GMA のバナー自動リフレッシュは **AdMob 管理画面（広告ユニットの設定）側の機能であり、SDK の API ではない**。本ライブラリはこれに一切関与しない。リフレッシュ間隔を変更したい場合は AdMob の管理画面で設定する。
