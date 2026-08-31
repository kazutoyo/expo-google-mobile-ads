---
title: "はじめに"
description: "Google Mobile Ads (AdMob) SDK を Expo Modules でラップしたライブラリです。"
---

[Google Mobile Ads (AdMob)](https://developers.google.com/admob) SDK を Expo Modules でラップしたライブラリです。Android は [GMA Next-Gen SDK](https://developers.google.com/admob/android/next-gen/quick-start)、iOS は Google Mobile Ads SDK v13 系を使います。

```sh
npx expo install @kazutoyo/expo-google-mobile-ads
```

## できること

- **バナー広告** — 固定サイズとアダプティブサイズに対応します。広告は表示する View と切り離して生成できるため、画面が表示される前にロードを始められます
- **インタースティシャル広告 / リワード広告** — こちらもプリロードできます。`show()` は Promise を返し、リワード広告は獲得した報酬で resolve します
- **UMP 同意管理** — 同意の取得、フォームの表示、プライバシーオプションの再表示
- **config plugin** — App ID をネイティブプロジェクトに埋め込み、メディエーションアダプタの依存も追加します

ネイティブ広告、アプリ起動時広告（App Open）、リワード広告のサーバーサイド検証には対応していません。

## 動作要件

- **Expo SDK 57 以降** — `peerDependencies` で宣言しているため、バージョンが合わないときはネイティブビルドを待たずに npm / yarn のインストール時にわかります
- **New Architecture 専用**です。Old Architecture では動きません
- **iOS 16.4 以降**、**Android minSdk 24 以降**

iOS 16.4 という下限は、広告 SDK ではなく Expo の都合によるものです。`ExpoModulesCore` が SDK 56 以降で `:ios => '16.4'` を宣言しています（広告 SDK v13 自体は iOS 13 で動きます）。アプリの `ios.deploymentTarget` がこれより低いと、pod をインストールできません。

ネイティブコードを含むため、**Expo Go では動きません**。development build が必要です。

## はじめかた

1. [インストール](/ja/installation) — config plugin に App ID を渡します
2. [同意管理 (UMP)](/ja/consent) — 同意を取得します
3. [SDK の初期化](/ja/initialization) — `initialize()` を呼びます
4. [バナー広告](/ja/banner-ads)、[インタースティシャル / リワード広告](/ja/fullscreen-ads) — 広告をロードして表示します
