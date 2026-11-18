---
title: "SDK の初期化"
description: "起動時に initialize() を1回呼びます。ライブラリが自動で初期化しない理由も説明します。"
---

広告をロードする前に、アプリの起動時に一度だけ `initialize()` を呼びます。

```typescript
import { initialize } from '@kazutoyo/expo-google-mobile-ads';

await initialize();
```

**このライブラリは自動で初期化しません。** 同意との順序も決めません。この判断をアプリ側に委ねている理由は [`initialize()`](/ja/api#initialize) を参照してください。

`initialize()` の前に広告を作ってもエラーにはなりません。ロードは初期化が終わるまでキューに積まれます。ただし `initialize()` を一度も呼ばないと、広告は `loading` のまま止まります。そのため、未初期化の状態で広告を作ると `__DEV__` で警告を表示します。
