---
title: "はじめに"
description: "Expo Modules ネイティブな Google Mobile Ads (AdMob) SDK ラッパー。"
---

Expo Modules ネイティブな [Google Mobile Ads (AdMob)](https://developers.google.com/admob) SDK ラッパー。バナー・インタースティシャル・リワード広告と、UMP 同意管理に対応している。

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
- **Expo SDK 57 以降** — `peerDependencies` に書いてあるので、合わないバージョンはネイティブビルドを待たず npm/yarn の時点でわかる
- **iOS 16.4 以降**、**Android minSdk 24 以降**。iOS の下限は広告 SDK ではなく Expo 側の都合で、`ExpoModulesCore` が SDK 56 以降 `:ios => '16.4'` を宣言している（広告 SDK v13 自体は iOS 13 で動く）。アプリの `ios.deploymentTarget` がこれより低いと pod を入れられない
- バナー・インタースティシャル・リワード広告・UMP 同意管理（フェーズ1〜3）

未対応:

- ネイティブ広告 — フェーズ4
- アプリ起動時広告（App Open）
- リワード広告のサーバーサイド検証
