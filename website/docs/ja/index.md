---
title: "はじめに"
description: "Expo Modules ネイティブな Google Mobile Ads (AdMob) SDK ラッパーです。"
---

Expo Modules ネイティブな [Google Mobile Ads (AdMob)](https://developers.google.com/admob) SDK ラッパーです。Android は [GMA Next-Gen SDK](https://developers.google.com/admob/android/next-gen/quick-start)、iOS は Google Mobile Ads SDK v13 系を使っています。

```sh
npx expo install @kazutoyo/expo-google-mobile-ads
```

## できること

- **バナー広告** — 固定サイズとアダプティブサイズに対応しています。広告は表示する View とは独立して生成できるので、画面が現れる前にロードを始められます
- **インタースティシャル広告 / リワード広告** — こちらも同じくプリロードできます。`show()` は Promise を返し、リワード広告は獲得した報酬で resolve します
- **UMP 同意管理** — 同意の取得、フォームの表示、プライバシーオプションの再表示
- **config plugin** — App ID をネイティブプロジェクトに埋め込み、メディエーションアダプタの依存も追加できます

未対応なのは、ネイティブ広告・アプリ起動時広告（App Open）・リワード広告のサーバーサイド検証です。

## 動作要件

- **Expo SDK 57 以降** — `peerDependencies` に書いているので、バージョンが合わないときはネイティブビルドを待たずに npm/yarn の時点でわかります
- **New Architecture 専用**です。Old Architecture は対象外です
- **iOS 16.4 以降**、**Android minSdk 24 以降**。iOS の下限は広告 SDK ではなく Expo 側の都合で、`ExpoModulesCore` が SDK 56 以降 `:ios => '16.4'` を宣言しています（広告 SDK v13 自体は iOS 13 で動きます）。アプリの `ios.deploymentTarget` がこれより低いと pod を入れられません

ネイティブコードを含むため、**Expo Go では動きません**。development build が必要になります。

## はじめかた

まず [インストール](/ja/installation) で、config plugin に App ID を渡すところから始めます。

そのあとは、[同意管理 (UMP)](/ja/consent) で同意を取り、[SDK の初期化](/ja/initialization) を済ませてから、[バナー広告](/ja/banner-ads) や [インタースティシャル / リワード広告](/ja/fullscreen-ads) をロードする、という流れになります。
