---
title: "SDK の初期化"
description: "起動時に initialize() を1回呼ぶ。なぜライブラリが自動で初期化しないのか。"
---

広告をロードする前に、アプリ起動時に一度だけ `initialize()` を呼ぶ。

```typescript
import { initialize } from '@kazutoyo/expo-google-mobile-ads';

await initialize();
```

**このライブラリは自動初期化を行わない。** 呼び出しは必ず明示的である。

理由は、初期化と UMP の同意取得の順序について Google 自身の案内が割れているため。旧来の案内は「同意取得が先」（`initialize()` がメディエーションアダプタによる広告プリロードを引き起こすため）、現行の案内は「初期化が先でよい」（初期化自体は個人データを処理せず、`canRequestAds()` が true になるまで広告をリクエストしなければポリシー準拠）としている。ここはアプリごとの法務判断が絡みうる領域であり、ネイティブ側で自動初期化してしまうと、揺れている解釈のどちらかをライブラリが勝手に選び、アプリから変更できなくなる。**この順序を決めるのはアプリであってライブラリではない。**

`initialize()` が呼ばれる前に `createBannerAd()` / `createInterstitialAd()` / `createRewardedAd()` を呼んでもエラーにはならない（ロードは初期化完了まで内部でキューされる）。ただし `initialize()`自体が一度も呼ばれない場合、広告は永久に `loading` のまま止まる。これを検知するため、`initialize()` 未呼び出しの状態で広告を作ると `__DEV__` で警告が出る。
