---
title: "インストール"
description: "パッケージのインストール、config plugin の設定、AdMob App ID の受け渡し。"
---

```sh
npx expo install @kazutoyo/expo-google-mobile-ads
```

ネイティブコードを含むので、**Expo Go では動きません**。development build が必要になります。ローカルなら `npx expo run:ios` / `npx expo run:android`、EAS なら `eas build --profile development` です。Expo Go のプロジェクトに入れると `requireNativeModule` で「モジュールが見つからない」と出ますが、これはライブラリの不具合ではありません。

下の config plugin は App ID をネイティブプロジェクトに書き込みます。変更したときは再生成**と**ビルドの両方が必要です。`npx expo prebuild --clean` のあとに `npx expo run:ios` / `npx expo run:android`、または EAS でビルドし直してください。`prebuild` はプロジェクトを書き換えるだけで端末には何も入りませんし、JavaScript のリロードではどちらも起きません。

## config plugin の設定

`app.json`（または `app.config.js`）の `plugins` に AdMob の App ID を渡します。

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

plugin はビルド時に App ID の有無と形式を検証します。未設定のときや、広告**ユニット** ID（`ca-app-pub-xxxx/yyyy` とスラッシュ区切り）を App ID の場所に渡したときは、その場でビルドを止めて理由を出します。App ID はチルダ区切りの `ca-app-pub-xxxxxxxxxxxxxxxx~xxxxxxxxxx` です。

この取り違えは AdMob で最も多い間違いかと思います。素通ししてしまうと Google SDK の奥で iOS はクラッシュ、Android は例外になり、原因がまず分かりません。

`delayAppMeasurementInit: true` を渡すと、UMP の同意が取れるまで計測データの送信を遅らせる設定を両 OS に書き込みます（[同意管理 (UMP)](/ja/consent) を参照してください）。
