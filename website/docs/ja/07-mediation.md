---
title: "メディエーション"
description: "config plugin の依存フック経由でメディエーションアダプタを追加する。"
---

このライブラリはメディエーションアダプタのバージョンを固定した「キュレート済みリスト」を持たない。アダプタのバージョンは頻繁に更新され、ライブラリ側で固定すると陳腐化する保守負債になるためである。代わりに config plugin に素の指定口を用意しており、必要な依存関係を自分で指定する。

以下の例は AppLovin を完全な実例として使っている — そのままコピーの出発点にできる、実在する Android のアーティファクト座標と iOS の pod バージョンである。

```json
{
  "expo": {
    "plugins": [
      [
        "@kazutoyo/expo-google-mobile-ads",
        {
          "androidAppId": "ca-app-pub-xxxx~yyyy",
          "iosAppId": "ca-app-pub-xxxx~zzzz",
          "androidDependencies": [
            "com.google.ads.mediation:applovin:13.6.4.0"
          ],
          "iosPods": {
            "GoogleMobileAdsMediationAppLovin": "13.6.3.0"
          }
        }
      ]
    ]
  }
}
```

上の例で Android と iOS のバージョンが異なっているのは意図的である。両アダプタは独立にバージョニングされており、しばしば食い違う。**片方のプラットフォームの番号をもう片方に流用してはならない。** それぞれ自分の changelog から読むこと。

**changelog を読むときは「(In progress)」に注意する。** Google のアダプタ changelog は、まだリリースされていない*次の*バージョンを最上段に `(In progress)` 付きで載せている。一番上の番号をそのまま取ると存在しないバージョンを指すことになり、`pod install` や Gradle の解決に失敗する。`(In progress)` の見出しがある場合は、その*下*の最初のエントリを取ること。

**バージョンは動く — ここからコピーしたまま放置しないこと。** 各ネットワークの現在のバージョンは、追加する時点で下記の changelog から取得する。他のネットワークについては、下表のアーティファクト ID（Android）または pod 名（iOS）に、changelog が示す時点のバージョンを添えて追加する。

| ネットワーク | Android | iOS |
|---|---|---|
| AppLovin | `com.google.ads.mediation:applovin` ([changelog](https://developers.google.com/admob/android/mediation/applovin)) | `GoogleMobileAdsMediationAppLovin` ([changelog](https://developers.google.com/admob/ios/mediation/applovin)) |
| Pangle | `com.google.ads.mediation:pangle` ([changelog](https://developers.google.com/admob/android/mediation/pangle)) | `GoogleMobileAdsMediationPangle` ([changelog](https://developers.google.com/admob/ios/mediation/pangle)) |
| Unity Ads | `com.google.ads.mediation:unity` ([changelog](https://developers.google.com/admob/android/mediation/unity)) | `GoogleMobileAdsMediationUnity` ([changelog](https://developers.google.com/admob/ios/mediation/unity)) |
| ironSource | `com.google.ads.mediation:ironsource` ([changelog](https://developers.google.com/admob/android/mediation/ironsource)) | `GoogleMobileAdsMediationIronSource` ([changelog](https://developers.google.com/admob/ios/mediation/ironsource)) |
| LY Ads Network（旧 LINE Ads Network） | `com.google.ads.mediation:line` ([changelog](https://developers.google.com/admob/android/mediation/line)) | `GoogleMobileAdsMediationLine` ([changelog](https://developers.google.com/admob/ios/mediation/line)) |

`androidMavenRepositories` はネットワーク固有の Maven リポジトリ（例: Pangle）が必要な場合にのみ指定する。
