# @kazutoyo/expo-google-mobile-ads

[![npm](https://img.shields.io/npm/v/@kazutoyo/expo-google-mobile-ads)](https://www.npmjs.com/package/@kazutoyo/expo-google-mobile-ads)
[![CI](https://github.com/kazutoyo/expo-google-mobile-ads/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/kazutoyo/expo-google-mobile-ads/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/@kazutoyo/expo-google-mobile-ads)](LICENSE)

*([English](./README.md) | 日本語)*

Expo Modules ネイティブな [Google Mobile Ads (AdMob)](https://developers.google.com/admob) SDK ラッパー。バナー・インタースティシャル・リワード広告と、UMP 同意管理に対応している。

📖 **[ドキュメント](https://kazutoyo.github.io/expo-google-mobile-ads/ja)** — インストール、同意管理、各広告フォーマット、API リファレンス。

## なぜこのライブラリか

設計の中心は、広告インスタンスと表示 View を分けたことにある。Expo Modules API の `SharedObject` で広告を持つので、広告は View と無関係に生成でき、生成した時点でロードが走る。画面が現れる前に広告を用意しておける。

- **プリロードできる** — `createBannerAd()` は React の外、画面遷移の前でもアプリ起動時でも呼べる。ロードは View を待たずに始まり（`initialize()` の完了までは内部のキューに積まれる）、View は後から付ければよい
- **画面をまたいで再利用できる** — `<BannerAdView ad={ad} />` はアンマウント時にデタッチするだけで、広告を破棄しない。同じ広告を別の画面でそのまま出せる
- **hooks が薄い** — `useBannerAd` / `useBannerAdState` は命令的な API のラッパーでしかない。hooks で足りなければ、下の層をそのまま触れる
- **レイアウトシフトが起きない** — `BannerAdSize` のサイズ計算は同期関数で、ロードを待たない。広告が届く前に表示領域を確定できる

`react-native-google-mobile-ads` は React Native の TurboModules 向けで、広告は表示する View と一体で生成される。プリロードを前提に組むなら、この違いが効いてくる。

Android は [GMA Next-Gen SDK](https://developers.google.com/admob/android/next-gen/quick-start)、iOS は Google Mobile Ads SDK v13 系を使う。

## サポート範囲

- **New Architecture 専用**。Old Architecture は対象外
- **Expo SDK 57 以降**、**iOS 16.4 以降**、**Android minSdk 24 以降**
- バナー・インタースティシャル・リワード広告・UMP 同意管理

未対応: ネイティブ広告、アプリ起動時広告（App Open）、リワード広告のサーバーサイド検証。

## インストール

```sh
npx expo install @kazutoyo/expo-google-mobile-ads
```

ネイティブコードを含むので、**Expo Go では動かない**。development build が要る。

AdMob の App ID を `app.json` の config plugin に渡す:

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

あとは同意を取り、初期化して、広告をロードする:

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

plugin が何を検証しているかは[インストールガイド](https://kazutoyo.github.io/expo-google-mobile-ads/ja/installation)、UMP のフロー全体は[同意管理](https://kazutoyo.github.io/expo-google-mobile-ads/ja/consent)を参照。

## ドキュメント

| | |
|---|---|
| [インストール](https://kazutoyo.github.io/expo-google-mobile-ads/ja/installation) | config plugin、App ID、development build |
| [SDK の初期化](https://kazutoyo.github.io/expo-google-mobile-ads/ja/initialization) | ライブラリが自動で初期化しない理由 |
| [同意管理 (UMP)](https://kazutoyo.github.io/expo-google-mobile-ads/ja/consent) | 同意フロー、`useConsentInfo()`、テスト方法 |
| [バナー広告](https://kazutoyo.github.io/expo-google-mobile-ads/ja/banner-ads) | プリロード、hooks、自動リフレッシュ |
| [BannerAdSize](https://kazutoyo.github.io/expo-google-mobile-ads/ja/banner-sizes) | 固定サイズとアダプティブサイズ |
| [インタースティシャル / リワード広告](https://kazutoyo.github.io/expo-google-mobile-ads/ja/fullscreen-ads) | 使い切りの全画面広告、報酬 |
| [メディエーション](https://kazutoyo.github.io/expo-google-mobile-ads/ja/mediation) | config plugin 経由でのアダプタ追加 |
| [API リファレンス](https://kazutoyo.github.io/expo-google-mobile-ads/ja/api-reference) | パッケージルートからのエクスポート一覧 |

## 開発

ドキュメントサイトは [`website/`](website) にあり、[Blume](https://useblume.dev/) で作っている。`cd website && npm install && npm run dev` で編集できる。

## ライセンス

MIT
