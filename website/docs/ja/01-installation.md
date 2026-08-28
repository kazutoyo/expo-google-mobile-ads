---
title: "インストール"
description: "パッケージのインストール、config plugin の設定、AdMob App ID の受け渡し。"
---

```sh
npx expo install @kazutoyo/expo-google-mobile-ads
```

このモジュールはネイティブコードを含むため、**Expo Go では動作しない**。development build が必要になる。ローカルなら `npx expo run:ios` / `npx expo run:android`、EAS なら `eas build --profile development`。Expo Go のプロジェクトに入れると `requireNativeModule` で「モジュールが見つからない」というエラーになるが、これはライブラリの不具合ではない。

後述の config plugin は App ID をネイティブプロジェクトに書き込むため、変更したらネイティブプロジェクトの再生成**と**ビルドの両方が必要になる。`npx expo prebuild --clean` のあとに `npx expo run:ios` / `npx expo run:android`、あるいは EAS でビルドし直す。`prebuild` 単体はプロジェクトを書き換えるだけで端末には何もインストールしないし、JavaScript のリロードではどちらも起きない。

## config plugin の設定

`app.json`（または `app.config.js`）の `plugins` に AdMob の App ID を渡す。

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

plugin はビルド時に App ID の存在と形式を検証する。未設定、または広告**ユニット** ID（`ca-app-pub-xxxx/yyyy` のようにスラッシュ区切り）を App ID の場所に渡した場合は、ビルドをその場で失敗させ、原因が分かるメッセージを出す。App ID は `ca-app-pub-xxxxxxxxxxxxxxxx~xxxxxxxxxx`（チルダ区切り）の形式である。この取り違えは AdMob 初心者が最も踏みやすい落とし穴で、放置すると Google SDK 側で分かりにくいクラッシュ（iOS）や例外（Android）になる。

`delayAppMeasurementInit: true` を渡すと、UMP の同意取得が終わるまで計測の送信を遅らせる設定を両 OS に書き込む(詳細は[同意管理 (UMP)](/ja/consent) のページを参照)。
