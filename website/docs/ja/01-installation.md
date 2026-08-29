---
title: "インストール"
description: "パッケージのインストール、config plugin の設定、AdMob App ID の受け渡し。"
---

```sh
npx expo install @kazutoyo/expo-google-mobile-ads
```

ネイティブコードを含むので、**Expo Go では動かない**。development build が要る。ローカルなら `npx expo run:ios` / `npx expo run:android`、EAS なら `eas build --profile development`。Expo Go のプロジェクトに入れると `requireNativeModule` で「モジュールが見つからない」と出るが、これはライブラリの不具合ではない。

下の config plugin は App ID をネイティブプロジェクトに書き込む。変更したら再生成**と**ビルドの両方が要る。`npx expo prebuild --clean` のあとに `npx expo run:ios` / `npx expo run:android`、または EAS でビルドし直す。`prebuild` はプロジェクトを書き換えるだけで端末には何も入らないし、JavaScript のリロードではどちらも起きない。

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

plugin はビルド時に App ID の有無と形式を検証する。未設定のとき、あるいは広告**ユニット** ID（`ca-app-pub-xxxx/yyyy` とスラッシュ区切り）を App ID の場所に渡したときは、その場でビルドを止めて理由を出す。App ID はチルダ区切りの `ca-app-pub-xxxxxxxxxxxxxxxx~xxxxxxxxxx` だ。この取り違えは AdMob で最も多い間違いで、素通しすると Google SDK の奥で iOS はクラッシュ、Android は例外になる。原因がまず分からない。

`delayAppMeasurementInit: true` を渡すと、UMP の同意が取れるまで計測データの送信を遅らせる設定を両 OS に書き込む（[同意管理 (UMP)](/ja/consent) を参照）。
