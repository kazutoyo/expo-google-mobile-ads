---
title: "メディエーション"
description: "config plugin の依存フック経由でメディエーションアダプタを追加する。"
---

このライブラリはメディエーションアダプタのバージョンを固定した「キュレート済みリスト」を持たない。アダプタは頻繁に更新されるので、ここで固定しても腐るだけだ。代わりに config plugin が依存を素で受け取る口を持っていて、必要なものを自分で指定する。

以下は AppLovin での実例。実在する Android のアーティファクト座標と iOS の pod バージョンなので、そのままコピーの出発点にできる。

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

上の例で Android と iOS のバージョンが違うのは意図的だ。両アダプタは独立にバージョニングされていて、よく食い違う。**片方の番号をもう片方に流用してはいけない。** それぞれの changelog から読む。

**changelog を読むときは「(In progress)」に注意する。** Google のアダプタ changelog は、まだ出ていない*次の*バージョンを最上段に `(In progress)` 付きで載せる。一番上をそのまま取ると存在しない番号になり、`pod install` や Gradle の解決が失敗する。`(In progress)` があれば、その*下*の最初のエントリを取る。

**バージョンは動く。ここからコピーしたまま放置しない。** 追加する時点で、下の changelog から現在のバージョンを取る。他のネットワークも同じで、下表のアーティファクト ID（Android）か pod 名（iOS）に、そのとき changelog が示すバージョンを添える。

| ネットワーク | Android | iOS |
|---|---|---|
| AppLovin | `com.google.ads.mediation:applovin` ([changelog](https://developers.google.com/admob/android/mediation/applovin)) | `GoogleMobileAdsMediationAppLovin` ([changelog](https://developers.google.com/admob/ios/mediation/applovin)) |
| Pangle | `com.google.ads.mediation:pangle` ([changelog](https://developers.google.com/admob/android/mediation/pangle)) | `GoogleMobileAdsMediationPangle` ([changelog](https://developers.google.com/admob/ios/mediation/pangle)) |
| Unity Ads | `com.google.ads.mediation:unity` ([changelog](https://developers.google.com/admob/android/mediation/unity)) | `GoogleMobileAdsMediationUnity` ([changelog](https://developers.google.com/admob/ios/mediation/unity)) |
| ironSource | `com.google.ads.mediation:ironsource` ([changelog](https://developers.google.com/admob/android/mediation/ironsource)) | `GoogleMobileAdsMediationIronSource` ([changelog](https://developers.google.com/admob/ios/mediation/ironsource)) |
| LY Ads Network（旧 LINE Ads Network） | `com.google.ads.mediation:line` ([changelog](https://developers.google.com/admob/android/mediation/line)) | `GoogleMobileAdsMediationLine` ([changelog](https://developers.google.com/admob/ios/mediation/line)) |

`androidMavenRepositories` は、ネットワーク固有の Maven リポジトリが要るとき（Pangle など）だけ指定する。
