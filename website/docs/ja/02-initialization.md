---
title: "SDK の初期化"
description: "起動時に initialize() を1回呼びます。ライブラリが自動で初期化しない理由も。"
---

広告をロードする前に、アプリ起動時に一度だけ `initialize()` を呼びます。

```typescript
import { initialize } from '@kazutoyo/expo-google-mobile-ads';

await initialize();
```

**このライブラリは自動では初期化しません。** 同意との順序も決めません。なぜアプリ側の判断になるのかは [`initialize()`](/ja/api#initialize) を参照してください。

`initialize()` の前に広告を作ってもエラーにはならず、ロードは初期化が終わるまでキューに積まれます。ただし `initialize()` を一度も呼ばないと広告は `loading` のまま止まり続けるので、未初期化の状態で広告を作ると `__DEV__` で警告を出すようにしています。
