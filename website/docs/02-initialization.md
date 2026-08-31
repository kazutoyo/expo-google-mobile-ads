---
title: "Initializing the SDK"
description: "Call initialize() once at startup, and why the library never does it for you."
---

Call `initialize()` once at app startup, before loading any ads.

```typescript
import { initialize } from '@kazutoyo/expo-google-mobile-ads';

await initialize();
```

**This library never initializes itself**, and it does not decide where initialization sits relative to consent. See [`initialize()`](/api#initialize) for why that ordering is the app's call.

Creating an ad before `initialize()` has been called is not an error: the load is queued until initialization completes. But if `initialize()` is never called at all, the ad stays `loading` forever, so creating one before it has run logs a `__DEV__` warning.
