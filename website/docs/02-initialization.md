---
title: "Initializing the SDK"
description: "Call initialize() once at startup — and why the library never does it for you."
---

Call `initialize()` once at app startup, before loading any ads.

```typescript
import { initialize } from '@kazutoyo/expo-google-mobile-ads';

await initialize();
```

**This library never initializes itself.** The call is always explicit.

The reason: Google's own guidance on the ordering of initialization versus UMP consent has shifted over time. The older guidance said consent must come first, because `initialize()` triggers ad preloading by mediation adapters; current guidance says initializing first is fine, since initialization itself doesn't process personal data and staying policy-compliant only requires not requesting ads until `canRequestAds()` is true. This is a decision that can carry legal weight for an app, and if the native side auto-initialized, the library would be silently picking one of these shifting interpretations for you, with no way for the app to override it. **The app decides this ordering, not the library.**

Calling `createBannerAd()`, `createInterstitialAd()`, or `createRewardedAd()` before `initialize()` has been called is not an error — loading is queued internally until initialization completes. But if `initialize()` is never called at all, the ad stays `loading` forever. To catch that early, creating an ad while `initialize()` hasn't run yet logs a `__DEV__` warning.
