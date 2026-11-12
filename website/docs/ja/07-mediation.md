---
title: "メディエーション"
description: "config plugin の依存フック経由でメディエーションアダプタを追加します。"
---

このライブラリは、メディエーションアダプタのバージョンを固定したリストを持っていません。アダプタは頻繁に更新されるため、固定するとすぐに古くなるからです。代わりに、config plugin が依存関係をそのまま受け取ります。必要なアダプタは自分で指定してください。

以下は AppLovin の例です。Android のアーティファクト座標と iOS の pod バージョンはどちらも実在するものなので、そのままコピーの出発点にできます。

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

上の例で Android と iOS のバージョンが違うのは意図的です。両アダプタは独立してバージョニングされており、番号は頻繁に食い違います。**片方の番号をもう片方に流用しないでください。** バージョンはそれぞれの changelog で確認します。

**changelog を読むときは `(In progress)` に注意してください。** Google のアダプタ changelog は、まだリリースされていない*次の*バージョンを、最上段に `(In progress)` 付きで掲載します。一番上をそのまま使うと存在しないバージョンになり、`pod install` や Gradle の依存解決が失敗します。`(In progress)` が付いていたら、その*下*の最初のエントリを使ってください。

**バージョンは更新されます。ここからコピーした値をそのまま使い続けないでください。** アダプタを追加する時点で、下表の changelog から最新のバージョンを確認します。他のネットワークも同様に、下表のアーティファクト ID（Android）または pod 名（iOS）へ、その時点の changelog が示すバージョンを添えてください。

| ネットワーク | Android | iOS |
|---|---|---|
| AppLovin | `com.google.ads.mediation:applovin` ([changelog](https://developers.google.com/admob/android/mediation/applovin)) | `GoogleMobileAdsMediationAppLovin` ([changelog](https://developers.google.com/admob/ios/mediation/applovin)) |
| Pangle | `com.google.ads.mediation:pangle` ([changelog](https://developers.google.com/admob/android/mediation/pangle)) | `GoogleMobileAdsMediationPangle` ([changelog](https://developers.google.com/admob/ios/mediation/pangle)) |
| Unity Ads | `com.google.ads.mediation:unity` ([changelog](https://developers.google.com/admob/android/mediation/unity)) | `GoogleMobileAdsMediationUnity` ([changelog](https://developers.google.com/admob/ios/mediation/unity)) |
| ironSource | `com.google.ads.mediation:ironsource` ([changelog](https://developers.google.com/admob/android/mediation/ironsource)) | `GoogleMobileAdsMediationIronSource` ([changelog](https://developers.google.com/admob/ios/mediation/ironsource)) |
| LY Ads Network（旧 LINE Ads Network） | `com.google.ads.mediation:line` ([changelog](https://developers.google.com/admob/android/mediation/line)) | `GoogleMobileAdsMediationLine` ([changelog](https://developers.google.com/admob/ios/mediation/line)) |

`androidMavenRepositories` は、ネットワーク固有の Maven リポジトリが必要なとき（Pangle など）だけ指定します。
