---
title: "メディエーション"
description: "config plugin の依存フック経由でメディエーションアダプタを追加します。"
---

このライブラリは、メディエーションアダプタのバージョンを固定した「キュレート済みリスト」を持っていません。アダプタは頻繁に更新されるので、ここで固定しても腐ってしまうためです。代わりに config plugin が依存を素で受け取る口を持っているので、必要なものを自分で指定してください。

以下は AppLovin での実例です。実在する Android のアーティファクト座標と iOS の pod バージョンなので、そのままコピーの出発点にできるかと思います。

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

上の例で Android と iOS のバージョンが違うのは意図的です。両アダプタは独立にバージョニングされていて、よく食い違います。**片方の番号をもう片方に流用しないでください。** それぞれの changelog から読む必要があります。

**changelog を読むときは「(In progress)」に注意してください。** Google のアダプタ changelog は、まだ出ていない*次の*バージョンを最上段に `(In progress)` 付きで載せています。一番上をそのまま取ると存在しない番号になってしまい、`pod install` や Gradle の解決が失敗します。`(In progress)` があれば、その*下*の最初のエントリを取ってください。

**バージョンは動くので、ここからコピーしたまま放置しないでください。** 追加する時点で、下の changelog から現在のバージョンを取ります。他のネットワークも同じで、下表のアーティファクト ID（Android）か pod 名（iOS）に、そのとき changelog が示すバージョンを添えてください。

| ネットワーク | Android | iOS |
|---|---|---|
| AppLovin | `com.google.ads.mediation:applovin` ([changelog](https://developers.google.com/admob/android/mediation/applovin)) | `GoogleMobileAdsMediationAppLovin` ([changelog](https://developers.google.com/admob/ios/mediation/applovin)) |
| Pangle | `com.google.ads.mediation:pangle` ([changelog](https://developers.google.com/admob/android/mediation/pangle)) | `GoogleMobileAdsMediationPangle` ([changelog](https://developers.google.com/admob/ios/mediation/pangle)) |
| Unity Ads | `com.google.ads.mediation:unity` ([changelog](https://developers.google.com/admob/android/mediation/unity)) | `GoogleMobileAdsMediationUnity` ([changelog](https://developers.google.com/admob/ios/mediation/unity)) |
| ironSource | `com.google.ads.mediation:ironsource` ([changelog](https://developers.google.com/admob/android/mediation/ironsource)) | `GoogleMobileAdsMediationIronSource` ([changelog](https://developers.google.com/admob/ios/mediation/ironsource)) |
| LY Ads Network（旧 LINE Ads Network） | `com.google.ads.mediation:line` ([changelog](https://developers.google.com/admob/android/mediation/line)) | `GoogleMobileAdsMediationLine` ([changelog](https://developers.google.com/admob/ios/mediation/line)) |

`androidMavenRepositories` は、ネットワーク固有の Maven リポジトリが要るとき（Pangle など）だけ指定します。
