---
title: "はじめに"
description: "Expo Modules ネイティブな Google Mobile Ads (AdMob) SDK ラッパーです。"
---

Expo Modules ネイティブな [Google Mobile Ads (AdMob)](https://developers.google.com/admob) SDK ラッパーです。バナー・インタースティシャル・リワード広告と、UMP 同意管理に対応しています。

## なぜこのライブラリか

このライブラリの設計は、広告インスタンスと表示 View を分けるところから始まっています。広告は Expo Modules API の `SharedObject` として持っているので、View がなくても生成できますし、生成した時点でロードが走ります。画面が現れる前に、広告だけ先に用意しておけます。

- **プリロードできる** — `createBannerAd()` は React の外から呼べます。画面遷移の前でも、アプリ起動時でも構いません。ロードは View を待たずに始まり（`initialize()` が終わるまでは内部のキューに積まれます）、View は後から付ければ大丈夫です
- **画面をまたいで再利用できる** — `<BannerAdView ad={ad} />` はアンマウント時にデタッチするだけで、広告そのものは破棄しません。同じ広告を別の画面でそのまま表示できます
- **hooks が薄い** — `useBannerAd` / `useBannerAdState` は命令的な API のラッパーでしかありません。hooks で足りない場面では、下の層をそのまま触れます
- **レイアウトシフトが起きない** — `BannerAdSize` のサイズ計算はロードを待たない同期関数です。広告が届く前に表示領域を確定できます

`react-native-google-mobile-ads` は React Native の TurboModules 向けで、広告は表示する View と一体で生成されます。プリロードを前提に組みたい場合は、この違いが効いてくるかと思います。

Android は [GMA Next-Gen SDK](https://developers.google.com/admob/android/next-gen/quick-start)、iOS は Google Mobile Ads SDK v13 系を使っています。

## サポート範囲

- **New Architecture 専用**です。Old Architecture は対象外です
- **Expo SDK 57 以降** — `peerDependencies` に書いているので、バージョンが合わないときはネイティブビルドを待たずに npm/yarn の時点でわかります
- **iOS 16.4 以降**、**Android minSdk 24 以降**。iOS の下限は広告 SDK ではなく Expo 側の都合で、`ExpoModulesCore` が SDK 56 以降 `:ios => '16.4'` を宣言しています（広告 SDK v13 自体は iOS 13 で動きます）。アプリの `ios.deploymentTarget` がこれより低いと pod を入れられません
- バナー・インタースティシャル・リワード広告・UMP 同意管理（フェーズ1〜3）

未対応:

- ネイティブ広告 — フェーズ4
- アプリ起動時広告（App Open）
- リワード広告のサーバーサイド検証
