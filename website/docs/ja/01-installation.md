---
title: "インストール"
description: "パッケージのインストール、config plugin の設定、AdMob App ID の受け渡し。"
---

```sh
npx expo install @kazutoyo/expo-google-mobile-ads
```

ネイティブコードを含むため、**Expo Go では動きません**。development build が必要です。ローカルでは `npx expo run:ios` / `npx expo run:android`、EAS では `eas build --profile development` でビルドします。Expo Go のプロジェクトに入れると `requireNativeModule` が「モジュールが見つからない」というエラーを出しますが、これはライブラリの不具合ではありません。

## config plugin の設定

`app.json`（または `app.config.js`）の `plugins` に、AdMob の App ID を渡します。

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

plugin はこの App ID をネイティブプロジェクトに書き込みます。App ID を変更したときは、プロジェクトの再生成**と**ビルドの両方が必要です。`npx expo prebuild --clean` を実行してから、`npx expo run:ios` / `npx expo run:android` か EAS でビルドし直してください。`prebuild` はプロジェクトファイルを書き換えるだけで、端末には何もインストールしません。JavaScript のリロードでは、どちらも実行されません。

plugin はビルド時に、App ID の有無と形式を検証します。未設定のとき、または広告**ユニット** ID（`ca-app-pub-xxxx/yyyy` とスラッシュ区切り）を App ID の場所に渡したときは、その場でビルドを止めて理由を表示します。App ID はチルダ区切りの `ca-app-pub-xxxxxxxxxxxxxxxx~xxxxxxxxxx` です。

この2つの取り違えは、AdMob でよくある間違いです。検証せずに通すと、Google SDK の内部で iOS はクラッシュし、Android は例外を投げるため、原因の特定が難しくなります。

`delayAppMeasurementInit: true` を渡すと、UMP の同意が取れるまで計測データの送信を遅らせる設定を、両 OS に書き込みます（[同意管理 (UMP)](/ja/consent) を参照してください）。
