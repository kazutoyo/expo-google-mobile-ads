# @kazutoyo/expo-google-mobile-ads

[![npm](https://img.shields.io/npm/v/@kazutoyo/expo-google-mobile-ads)](https://www.npmjs.com/package/@kazutoyo/expo-google-mobile-ads)
[![CI](https://github.com/kazutoyo/expo-google-mobile-ads/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/kazutoyo/expo-google-mobile-ads/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/@kazutoyo/expo-google-mobile-ads)](LICENSE)

*([English](./README.md) | 日本語)*

Expo Modules ネイティブな [Google Mobile Ads (AdMob)](https://developers.google.com/admob) SDK ラッパー。現時点ではバナー・インタースティシャル・リワード広告に加え、UMP 同意管理をサポートする。

📖 **[ドキュメント](https://kazutoyo.github.io/expo-google-mobile-ads/ja)** — インストール、同意管理、各広告フォーマット、API リファレンス。

## なぜこのライブラリか

既存の `react-native-google-mobile-ads` は React Native(TurboModules)を対象としており、Old Architecture 互換の名残を抱えている。その最大の代償が、**広告をプリロードできない**こと — 広告は表示するビューと一緒にしか生成できない。

このライブラリは Expo Modules API(`SharedObject`)の上に構築されており、広告インスタンスと表示ビューを意図的に分離している。

- **プリロード可能** — `createBannerAd()` は React の外で、画面遷移の前やアプリ起動時に呼べる。ロードはビューを待たずに始まり(`initialize()` が完了するまでは内部でキューイングされる)、ビューは後から取り付けられる
- **画面をまたいで再利用可能** — `<BannerAdView ad={ad} />` はアンマウント時に**デタッチするだけで破棄しない**。同じ広告インスタンスを別の画面で再表示できる
- **hooks ベース** — React からは `useBannerAd` / `useBannerAdState` という薄いラッパーを使う。それ以上のことはしない
- **レイアウトシフトなし** — `BannerAdSize` はロードを待たない同期関数でサイズを計算するため、広告が届く前に表示領域を確保できる

Android は [GMA Next-Gen SDK](https://developers.google.com/admob/android/next-gen/quick-start)、iOS は Google Mobile Ads SDK v13 を使う。

## サポート範囲

- **New Architecture 専用**。Old Architecture は対象外
- **Expo SDK 57 以降**、**iOS 16.4 以降**、**Android minSdk 24 以降**
- バナー・インタースティシャル・リワード広告・UMP 同意管理

未対応: ネイティブ広告、アプリ起動時広告(App Open)、リワード広告のサーバーサイド検証。

## インストール

```sh
npx expo install @kazutoyo/expo-google-mobile-ads
```

このモジュールはネイティブコードを含むため、**Expo Go では動作しない**。development build が必要になる。

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

あとは同意を取得し、初期化し、広告をロードする:

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

plugin が何を検証しているか、なぜそうしているかは[インストールガイド](https://kazutoyo.github.io/expo-google-mobile-ads/ja/installation)、UMP のフロー全体は[同意管理のページ](https://kazutoyo.github.io/expo-google-mobile-ads/ja/consent)を参照。

## ドキュメント

| | |
|---|---|
| [インストール](https://kazutoyo.github.io/expo-google-mobile-ads/ja/installation) | config plugin、App ID、development build |
| [SDK の初期化](https://kazutoyo.github.io/expo-google-mobile-ads/ja/initialization) | なぜライブラリが自動で初期化しないのか |
| [同意管理 (UMP)](https://kazutoyo.github.io/expo-google-mobile-ads/ja/consent) | 同意フロー、`useConsentInfo()`、テスト方法 |
| [バナー広告](https://kazutoyo.github.io/expo-google-mobile-ads/ja/banner-ads) | プリロード、hooks、自動リフレッシュ |
| [BannerAdSize](https://kazutoyo.github.io/expo-google-mobile-ads/ja/banner-sizes) | 固定サイズとアダプティブサイズ |
| [インタースティシャル / リワード広告](https://kazutoyo.github.io/expo-google-mobile-ads/ja/fullscreen-ads) | 使い切りの全画面広告、報酬 |
| [メディエーション](https://kazutoyo.github.io/expo-google-mobile-ads/ja/mediation) | config plugin 経由でのアダプタ追加 |
| [API リファレンス](https://kazutoyo.github.io/expo-google-mobile-ads/ja/api-reference) | パッケージルートからのエクスポート一覧 |

## 開発

ドキュメントサイトは [`website/`](website) にあり、[Blume](https://useblume.dev/) で構築している。`cd website && npm install && npm run dev` で編集できる。

## ライセンス

MIT
