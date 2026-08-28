---
title: "はじめに"
description: "Expo Modules ネイティブな Google Mobile Ads (AdMob) SDK ラッパー。"
---

Expo Modules ネイティブな [Google Mobile Ads (AdMob)](https://developers.google.com/admob) SDK ラッパー。現時点ではバナー・インタースティシャル・リワード広告に加え、UMP 同意管理をサポートする。

## なぜこのライブラリか

既存の `react-native-google-mobile-ads` は React Native (TurboModules) 向けであり、Old Architecture との互換を引きずっている。その制約のうち特に大きいのが **広告を先読み（プリロード）できない**ことで、広告は表示する View と一体でしか生成できない。

本ライブラリは Expo Modules API（`SharedObject`）の上に、広告インスタンスと表示 View を分離した設計で作られている。

- **プリロード可能** — `createBannerAd()` は React の外、画面遷移前やアプリ起動時に呼べる。ロードは View を待たずに始まり(`initialize()` の完了までは内部でキューイングされる)、View は後から付ければよい
- **画面をまたいで再利用可能** — `<BannerAdView ad={ad} />` はアンマウント時に **破棄せずデタッチのみ**を行う。同じ広告を別の画面で再表示できる
- **hooks ベース** — React から使うときは `useBannerAd` / `useBannerAdState` の薄いラッパーだけで済む
- **レイアウトシフトなし** — `BannerAdSize` のサイズ計算はロード完了を待たない同期関数なので、広告が届く前に表示領域を確定できる

Android は [GMA Next-Gen SDK](https://developers.google.com/admob/android/next-gen/quick-start)、iOS は Google Mobile Ads SDK v13 系を使用する。

## サポート範囲

- **New Architecture 専用**。Old Architecture は対象外
- **Expo SDK 57 以降** — `peerDependencies` で宣言しているため、バージョン不一致のインストールはネイティブビルドまで待たずに npm/yarn の時点で表面化する
- **iOS 16.4 以降**、**Android minSdk 24 以降**。iOS の下限は広告 SDK ではなく Expo 側の要求である（`ExpoModulesCore` が SDK 56 以降 `:ios => '16.4'` を宣言している）。Google Mobile Ads SDK v13 自体は iOS 13 で足りる。アプリの `ios.deploymentTarget` が 16.4 未満だとこの pod はインストールできない
- バナー・インタースティシャル・リワード広告・UMP 同意管理（フェーズ1〜3）

未対応:

- ネイティブ広告 — フェーズ4
- アプリ起動時広告（App Open）
- リワード広告のサーバーサイド検証
