---
title: ネイティブ広告
---

# ネイティブ広告

同意を取得し、`initialize()` を呼び出してから広告をロードします。

```tsx
import { Platform } from 'react-native';
import { useNativeAd, NativeAdView } from '@kazutoyo/expo-google-mobile-ads';

const adUnitId = Platform.select({
  android: 'ca-app-pub-3940256099942544/2247696110',
  ios: 'ca-app-pub-3940256099942544/3986624511',
})!;

function SponsoredCard() {
  const { ad, isLoaded, error } = useNativeAd({ adUnitId });
  if (error || !isLoaded) return null;
  return <NativeAdView ad={ad} style={{ height: 360 }} />;
}
```

広告表記（Ad）、アイコン、見出し、広告主、メディア、本文、CTA を含むカードを表示します。任意のアセットがない場合は該当部分を非表示にします。クリック・インプレッションの計測と AdChoices の表示は SDK が行います。カードに操作可能な要素を重ねないでください。

初期 API は組み込みカードレイアウトです。任意の React children やアセット配置のカスタマイズには対応していません。`style` でサイズを指定できます（既定の高さは360）。テキストとメディアが収まり、メディア部分が120ポイント/dp以上になる高さを確保してください。

`ad.assets` と `useNativeAdState(ad).assets` から headline、body、callToAction、advertiser、starRating、store、price、mediaAspectRatio を取得できます。クリック可能なアセットの描画には `NativeAdView` を使います。

同じ広告を複数のカードに渡すと、新しいカードへ表示を移し、古いカードをクリアします。アンマウントでは広告を解放しません。`load()` は現在の広告を置き換え、ロード中はカードを空にします。

## API

- `createNativeAd({ adUnitId, requestOptions? })`: preload outside React; call `release()` when finished.
- `useNativeAd(options)`: creates and releases the ad; `requestOptions` is read at creation time.
- `useNativeAdState(ad)`: subscribes without owning or releasing the ad.
- `ad.load()`: retry or reload before presentation.
- `ad.status`, `ad.error`, `ad.responseInfo`: current load state and diagnostics.
- Events: `statusChange`, `impression`, `clicked`, `paid`.

[Google integration guide](https://developers.google.com/admob/ios/native/advanced)
