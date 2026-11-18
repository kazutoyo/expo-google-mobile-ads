---
title: "インストール"
description: "パッケージのインストール、config plugin の設定、AdMob App ID の受け渡し。"
---

```sh
npx expo install @kazutoyo/expo-google-mobile-ads
```

ネイティブコードを含むため、**Expo Go では動きません**。development build が必要です。ローカルでは `npx expo run:ios` / `npx expo run:android`、EAS では `eas build --profile development` でビルドします。Expo Go のプロジェクトに入れると `requireNativeModule` が「モジュールが見つからない」というエラーを出しますが、これはライブラリの不具合ではありません。

## Swift Package Manager (iOS)

npm パッケージには、Expo SDK 58 の SwiftPM 連携（現在プレビュー）用の
`Package.swift` が含まれています。この連携を導入済みのアプリでは、Expo の
autolinking が `ExpoGoogleMobileAds` をソースからビルドし、Google 公式の
Swift パッケージから Google Mobile Ads SDK `13.12.0..<14.0.0` と
UMP `3.0.0..<4.0.0` を解決します。マニフェストには Swift 6.2 以降が必要です。
Xcode は利用する Expo SDK が対応しているバージョンを使ってください。

Xcode 27.2、Expo 58.0.26、expo-modules-macros 0.33.0 で、サンプルアプリ全体の
SwiftPM Debug ビルドを arm64／x86_64 の iOS Simulator 向けに確認しています。
この組み合わせでは回避策が必要です。サンプルはホスト用マクロを iOS の依存として
ビルドする代わりに Expo 同梱のマクロ実行ファイルを使い、移行後に残る CocoaPods 専用の
Expo 設定を除去します。[サンプルのビルド手順](https://github.com/kazutoyo/expo-google-mobile-ads/blob/main/example/README.md)を参照してください。
ライブラリが利用先の Expo を自動で書き換えることはありません。回避策を使わない場合、
この Expo バージョンでは `ExpoModulesMacrosCore` の SwiftSyntax 読み込みで失敗します。
CocoaPods も引き続き使えます。

npm パッケージをインストールしたあと、アプリのルートで SwiftPM の依存関係を更新します。

```sh
node node_modules/react-native/scripts/setup-apple-spm.js update
```

下の config plugin も設定してください。CocoaPods と SwiftPM のどちらでも
AdMob App ID と計測設定の書き込みに必要です。依存関係の更新後はネイティブアプリを
ビルドし直します。`Package.swift` は Expo が autolinking 時に生成する
`ExpoModulesCoreHeaders` に依存するため、Xcode の Add Package Dependencies から
このリポジトリを直接追加するのではなく、Expo 経由で使います。

メディエーション用の `iosPods` オプションは CocoaPods 専用です。SwiftPM のアプリでは、
各広告ネットワークの SwiftPM の手順に従ってアダプターを追加してください。
従来の podspec による CocoaPods でのインストールも利用できます。

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

plugin はこの App ID をネイティブプロジェクトに書き込みます。App ID を変更したときは、`npx expo prebuild` で再生成してから、`npx expo run:ios` / `npx expo run:android` か EAS でビルドし直してください。`npx expo prebuild --clean` は、ネイティブプロジェクトを削除して作り直す場合に使います。`ios/` と `android/` 内の手動変更も削除されます。`prebuild` だけでは端末に何もインストールしません。JavaScript のリロードでは、再生成もビルドも実行されません。

plugin はビルド時に、App ID の有無と形式を検証します。未設定のとき、または広告**ユニット** ID（`ca-app-pub-xxxx/yyyy` とスラッシュ区切り）を App ID の場所に渡したときは、その場でビルドを止めて理由を表示します。App ID はチルダ区切りの `ca-app-pub-xxxxxxxxxxxxxxxx~xxxxxxxxxx` です。

この2つの取り違えは、AdMob でよくある間違いです。検証せずに通すと、Google SDK の内部で iOS はクラッシュし、Android は例外を投げるため、原因の特定が難しくなります。

`delayAppMeasurementInit: true` を渡すと、UMP の同意が取れるまで計測データの送信を遅らせる設定を、両 OS に書き込みます（[同意管理 (UMP)](/ja/consent) を参照してください）。
