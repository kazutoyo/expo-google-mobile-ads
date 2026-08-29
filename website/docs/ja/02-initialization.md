---
title: "SDK の初期化"
description: "起動時に initialize() を1回呼ぶ。なぜライブラリが自動で初期化しないのか。"
---

広告をロードする前に、アプリ起動時に一度だけ `initialize()` を呼ぶ。

```typescript
import { initialize } from '@kazutoyo/expo-google-mobile-ads';

await initialize();
```

**このライブラリは自動初期化しない。** 呼び出しは必ず明示的にする。

初期化と UMP 同意の順序について、Google 自身の案内が時期によって割れているからだ。旧来は「同意が先」（`initialize()` がメディエーションアダプタによる広告プリロードを走らせるため）、現行は「初期化が先でよい」（初期化自体は個人データを扱わず、`canRequestAds()` が true になるまで広告をリクエストしなければポリシーは満たす）としている。

どちらを取るかは法務判断になりうる。ネイティブ側で勝手に初期化すると、揺れている解釈の片方をライブラリが選んだことになり、アプリ側から覆せない。**この順序を決めるのはアプリであってライブラリではない。**

`initialize()` の前に `createBannerAd()` / `createInterstitialAd()` / `createRewardedAd()` を呼んでもエラーにはならない。ロードは初期化が終わるまで内部のキューに積まれる。ただし `initialize()` を一度も呼ばなければ、広告は `loading` のまま永久に止まる。それに早く気づけるよう、未初期化の状態で広告を作ると `__DEV__` で警告を出す。
