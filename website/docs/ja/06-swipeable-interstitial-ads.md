---
title: "スワイプ可能なインタースティシャル広告"
description: "全画面の View やページ送りのフィードに広告を配置します。"
sidebar:
  order: 6.5
---

Swipeable Interstitial は、バナーと同じように広告オブジェクトと表示 View を分けて使います。全画面のコンテナに広告を配置し、スワイプ・画面遷移・閉じる操作はアプリ側で実装します。`show()` メソッドやスワイプで閉じる UI は付属しません。使用する SDK の API は現在 [iOS ではベータ](https://developers.google.com/admob/ios/api/beta/reference/Classes/GADSwipeableInterstitialAd)、[Android では実験的 API](https://developers.google.com/admob/android/next-gen/reference/kotlin/com/google/android/libraries/ads/mobile/sdk/swipeableinterstitial/SwipeableInterstitialAd) です。

[初期化](/ja/initialization)の手順に従い、広告をリクエストできる同意状態になってから `initialize()` を呼びます。初期化が完了するまでロードは待機します。

```tsx
import {
  SwipeableInterstitialAdView,
  useSwipeableInterstitialAd,
} from '@kazutoyo/expo-google-mobile-ads';

// 全画面の画面またはページに配置します。
// アカウントで設定した Swipeable Interstitial 用広告ユニット ID を渡してください。
export function SwipeableAdPage({ adUnitId }: { adUnitId: string }) {
  const { ad, isLoaded, error } = useSwipeableInterstitialAd({ adUnitId });
  if (error || !isLoaded) return null; // フィード側では未ロードの広告枠をスキップできます。
  return <SwipeableInterstitialAdView ad={ad} style={{ flex: 1 }} />;
}
```

サイズを省略すると端末の全画面サイズでリクエストします。独自のコンテナに合わせる場合は `size: { width, height }` をポイント（iOS）または dp（Android）で渡し、View にも同じ寸法を指定してください。幅・高さは正の整数です。インタースティシャルとして小さすぎるサイズは SDK が拒否します。ロード中も `style` のレイアウトは維持しますが、高さの自動計算はしません。

`useSwipeableInterstitialAd(options)` はアンマウント時に広告を解放します。`adUnitId`・幅・高さ・`maxScreenHoldDuration` が変わると広告を作り直します。`requestOptions` は生成時だけ読み取ります。React の外でプリロードする場合は `createSwipeableInterstitialAd(options)` で生成し、`useSwipeableInterstitialAdState(ad)` で購読して、使い終わったら `ad.release()` を呼びます。View のアンマウントだけでは広告は解放されません。同じ広告を複数の View に同時に渡さず、フィードの新しい広告枠には新しい広告を生成してください。

## 表示保持時間

`maxScreenHoldDuration` の既定値は `0` で、表示の保持を必要としない広告をリクエストします。0 より大きい値を指定する場合は、広告の可視状態を追跡し、ロード後の `minScreenHoldDuration` 秒が経過するまでスワイプ・閉じる操作・画面遷移を制限する処理をアプリ側で実装してください。指定できるのは 0 以上の整数です。

View のマウントや `screenHoldTimerStarted` の受信だけでは保持時間を強制できません。ページが非表示になったときやアプリがバックグラウンドに入ったときのタイマーの停止・リセットもアプリ側の責務です。このライブラリはタイマーや画面遷移を管理しません。

## 状態とイベント

広告オブジェクトには `status`（`'loading' | 'loaded' | 'error'`）・`error`・`responseInfo`・`minScreenHoldDuration`（秒）・`load()`・`release()` があります。`load()` は既存のクリエイティブを置き換えます。解放するとロード中の結果は破棄され、ネイティブ View も取り外されます。両 hook の戻り値は `{ isLoaded, error, minScreenHoldDuration }`、生成する hook には `ad` も含まれます。

`ad.addListener(event, listener)` で購読し、不要になったら戻り値の subscription を解除してください。

| イベント | 意味 |
| --- | --- |
| `statusChange` | `{ status, error? }`。ロードの完了・失敗・再開 |
| `impression` | SDK によるインプレッションの記録 |
| `clicked` | SDK によるクリックの記録 |
| `paid` | 他フォーマットと同じ `{ value, currencyCode, precision }` |
| `screenPresented` | 広告の操作で全画面オーバーレイが開いた |
| `screenDismissed` | そのオーバーレイが閉じた |
| `screenHoldTimerStarted` | SDK 内部の保持タイマー開始の参考通知 |

`screenPresented` と `screenDismissed` は広告を操作して開いたオーバーレイの通知です。フィードの広告ページ自体の表示・終了通知ではありません。
