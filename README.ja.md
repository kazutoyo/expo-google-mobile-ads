# @kazutoyo/expo-google-mobile-ads

[![npm](https://img.shields.io/npm/v/@kazutoyo/expo-google-mobile-ads)](https://www.npmjs.com/package/@kazutoyo/expo-google-mobile-ads)
[![CI](https://github.com/kazutoyo/expo-google-mobile-ads/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/kazutoyo/expo-google-mobile-ads/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/@kazutoyo/expo-google-mobile-ads)](LICENSE)

*([English](./README.md) | 日本語)*

Expo Modules ネイティブな [Google Mobile Ads (AdMob)](https://developers.google.com/admob) SDK ラッパーです。バナー・インタースティシャル・リワード広告と、UMP 同意管理に対応しています。

📖 **[ドキュメント](https://kazutoyo.github.io/expo-google-mobile-ads/ja)** — インストール、同意管理、各広告フォーマット、API リファレンスはこちらにあります。

## なぜこのライブラリか

このライブラリの設計は、広告インスタンスと表示 View を分けるところから始まっています。広告は Expo Modules API の `SharedObject` として持っているので、View がなくても生成できますし、生成した時点でロードが走ります。画面が現れる前に、広告だけ先に用意しておけます。

- **プリロードできる** — `createBannerAd()` は React の外から呼べます。画面遷移の前でも、アプリ起動時でも構いません。ロードは View を待たずに始まり（`initialize()` が終わるまでは内部のキューに積まれます）、View は後から付ければ大丈夫です
- **画面をまたいで再利用できる** — `<BannerAdView ad={ad} />` はアンマウント時にデタッチするだけで、広告そのものは破棄しません。同じ広告を別の画面でそのまま表示できます
- **hooks が薄い** — `useBannerAd` / `useBannerAdState` は命令的な API のラッパーでしかありません。hooks で足りない場面では、下の層をそのまま触れます
- **レイアウトシフトが起きない** — `BannerAdSize` のサイズ計算はロードを待たない同期関数です。広告が届く前に表示領域を確定できます

`react-native-google-mobile-ads` では、バナーは `<BannerAd unitId size />` というコンポーネントなので、バナー広告は表示する View と一緒に生成されます。インタースティシャルとリワードは独立したオブジェクト（`InterstitialAd.createForAdRequest()`）なのでプリロードできます。違いが出るのはバナーです。

Android は [GMA Next-Gen SDK](https://developers.google.com/admob/android/next-gen/quick-start)、iOS は Google Mobile Ads SDK v13 系を使っています。

## サポート範囲

- **New Architecture 専用**です。Old Architecture は対象外です
- **Expo SDK 57 以降**、**iOS 16.4 以降**、**Android minSdk 24 以降**
- バナー・インタースティシャル・リワード広告・UMP 同意管理

未対応なのは、ネイティブ広告・アプリ起動時広告（App Open）・リワード広告のサーバーサイド検証です。

## インストール

```sh
npx expo install @kazutoyo/expo-google-mobile-ads
```

ネイティブコードを含むので、**Expo Go では動きません**。development build が必要になります。

AdMob の App ID を `app.json` の config plugin に渡します。

```json
{
  "expo": {
    "plugins": [
      [
        "@kazutoyo/expo-google-mobile-ads",
        {
          "androidAppId": "ca-app-pub-3940256099942544~3347511713",
          "iosAppId": "ca-app-pub-3940256099942544~1458002511"
        }
      ]
    ]
  }
}
```

あとは同意を取って、初期化して、広告をロードします。

```typescript
import { gatherConsent, initialize, createBannerAd, BannerAdSize } from '@kazutoyo/expo-google-mobile-ads';

const { canRequestAds } = await gatherConsent();
if (canRequestAds) await initialize();

export const homeBannerAd = createBannerAd({
  adUnitId: 'ca-app-pub-3940256099942544/9214589741',
  size: BannerAdSize.BANNER,
});
```

```tsx
<BannerAdView ad={homeBannerAd} />
```

plugin が何を検証しているかは[インストールガイド](https://kazutoyo.github.io/expo-google-mobile-ads/ja/installation)、UMP のフロー全体は[同意管理](https://kazutoyo.github.io/expo-google-mobile-ads/ja/consent)を参照してください。

## ドキュメント

| | |
|---|---|
| [インストール](https://kazutoyo.github.io/expo-google-mobile-ads/ja/installation) | config plugin、App ID、development build |
| [SDK の初期化](https://kazutoyo.github.io/expo-google-mobile-ads/ja/initialization) | ライブラリが自動で初期化しない理由 |
| [同意管理 (UMP)](https://kazutoyo.github.io/expo-google-mobile-ads/ja/consent) | 同意フロー、`useConsentInfo()`、テスト方法 |
| [バナー広告](https://kazutoyo.github.io/expo-google-mobile-ads/ja/banner-ads) | プリロード、hooks、自動リフレッシュ |
| [バナーサイズの選び方](https://kazutoyo.github.io/expo-google-mobile-ads/ja/banner-sizes) | 固定サイズとアダプティブサイズ |
| [インタースティシャル / リワード広告](https://kazutoyo.github.io/expo-google-mobile-ads/ja/fullscreen-ads) | 使い切りの全画面広告、報酬 |
| [メディエーション](https://kazutoyo.github.io/expo-google-mobile-ads/ja/mediation) | config plugin 経由でのアダプタ追加 |
| [API](https://kazutoyo.github.io/expo-google-mobile-ads/ja/api) | パッケージルートからのエクスポート一覧 |

## 開発

ドキュメントサイトは [`website/`](website) にあり、[Blume](https://useblume.dev/) で作っています。`cd website && npm install && npm run dev` で編集できます。

## ライセンス

MIT
