# Full-Screen Ads (Interstitial + Rewarded) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add interstitial and rewarded ads, reusing phase 1's SharedObject-plus-hooks structure.

**Architecture:** Each ad is an Expo Modules SharedObject that loads immediately on creation and has no view. `show()` returns a Promise that settles when the ad is dismissed or fails to present. Ads are one-shot: after `show()` the status is `'shown'` and the caller creates a new one.

**Tech Stack:** Expo Modules API (SDK 57) / TypeScript / Kotlin (GMA Next-Gen 1.4.0) / Swift (GMA iOS 13.7.0) / Jest

**Spec:** `docs/superpowers/specs/2026-08-28-fullscreen-ads-design.md`

**API reconnaissance (read this before writing native code):** `.superpowers/sdd/phase2-api-recon.md` — every signature quoted from the installed binaries.

## Global Constraints

- All comments, doc comments, and user-facing messages in **English**. Commit messages in English.
- Expo SDK 54+, New Architecture only. TypeScript strict; `npx tsc --noEmit` must stay clean.
- Cross-platform parity is a hard requirement: the same JS call must behave identically on iOS and Android.
- `status` is exactly `'loading' | 'loaded' | 'shown' | 'error'`.
- Ads are **one-shot**. `'shown'` is terminal; `load()` never revives a shown ad.
- Ad load failures are NOT exceptions — they are `status` plus a `statusChange` event. Exceptions are for caller mistakes (`show()` on an ad that is not loaded) and configuration errors.
- `show()` rejects with `e.code` in `'notLoaded' | 'alreadyShown' | 'failedToShow'`.
- Test-driven for every JS task: write the failing test, run it, confirm it fails for the right reason, then implement, then confirm it passes.
- Baselines to hold: iOS 0 errors / 6 warnings, Android 0 errors / 9 warnings on a full rebuild. **An incremental build that skips the module reports 0 warnings — force a clean recompile and say so.** The iOS build output lives in `~/Library/Developer/Xcode/DerivedData/expogooglemobileadsexample-*`, not `example/ios/build`.
- Devices: Android emulator `emulator-5554`; iOS simulator iPhone 17, UDID `DE3572EA-B1F3-40D1-B440-3403C07CBA43`. The `Pixel_9a` AVD's `default_boot` snapshot is broken — start it with `emulator -avd Pixel_9a -no-snapshot-load` and do **not** wipe it.
- Google test ad units only: interstitial `ca-app-pub-3940256099942544/1033173712`, rewarded `ca-app-pub-3940256099942544/5224354917`. Never a real ad unit.

## Hard-won constraints from phase 1 — every native task must honour these

Each cost at least one fix round in phase 1, and none are detectable by a compiler:

1. Expo's synchronous `Function` and `Constructor` bodies run on the **JS thread**. UIKit and most GMA calls need the main thread. Android's `MobileAds.initialize()` is the inverse — background thread, or you risk ANR.
2. `sharedObjectWillRelease` / `sharedObjectDidRelease` are invoked **while Expo holds the shared-object registry lock**. Blocking on the main thread from there deadlocks against a mounting view. Post asynchronously.
3. The Activity / root view controller may be absent. Resolve it at the moment you need it, never cache it at construction, and surface a real error rather than failing silently.
4. Releasing must tear down: clear every callback and closure property, and call Android's `destroy()`.
5. `useEvent`'s `initialValue` is only `useState`'s initial argument, so state does not reset when the subscribed object changes. Key state on the ad instance (phase 1 does this with a `stateOwner` state variable reset during render).

## File Structure

| File | Responsibility |
|---|---|
| `src/types.ts` (modify) | Add `FullScreenAdStatus`, `AdReward`, `ShowAdErrorCode` |
| `src/FullScreenAd.ts` (create) | Shared helpers for both formats: `isReleased`, `loadWhenInitialized`, `show()` guards |
| `src/InterstitialAd.ts` (create) | `createInterstitialAd`, the `InterstitialAd` declaration |
| `src/RewardedAd.ts` (create) | `createRewardedAd`, the `RewardedAd` declaration |
| `src/hooks/useInterstitialAd.ts` (create) | `useInterstitialAd`, `useInterstitialAdState` |
| `src/hooks/useRewardedAd.ts` (create) | `useRewardedAd`, `useRewardedAdState` |
| `src/ExpoGoogleMobileAdsModule.ts` (modify) | Declare the two new native classes |
| `src/index.ts` (modify) | Public exports |
| `ios/FullScreenAd.swift` (create) | Shared base: presentation, lifecycle delegate, promise settlement |
| `ios/InterstitialAd.swift` (create) | iOS interstitial |
| `ios/RewardedAd.swift` (create) | iOS rewarded, including the earned-reward latch |
| `android/.../FullScreenAd.kt` (create) | Shared base |
| `android/.../InterstitialAd.kt` (create) | Android interstitial |
| `android/.../RewardedAd.kt` (create) | Android rewarded |
| `ios/ExpoGoogleMobileAdsModule.swift`, `android/.../ExpoGoogleMobileAdsModule.kt` (modify) | Register the new classes |
| `example/App.tsx`, `example/QA.md` (modify) | Manual QA |
| `README.md`, `README.ja.md` (modify) | Docs |

---

### Task 1: Shared types

**Files:**
- Modify: `src/types.ts`

**Interfaces:**
- Produces: `FullScreenAdStatus`, `AdReward`, `ShowAdErrorCode`

- [ ] **Step 1: Add the types**

Append to `src/types.ts`:

```typescript
/**
 * A full-screen ad's lifecycle. `'shown'` is terminal: these ads are one-shot on both SDKs
 * (iOS reports `AdAlreadyUsed`, Android `AD_REUSED`), so a shown ad is never reloaded —
 * create a new one instead.
 */
export type FullScreenAdStatus = 'loading' | 'loaded' | 'shown' | 'error';

/** What the user earned from a rewarded ad. */
export type AdReward = {
  type: string;
  amount: number;
};

/**
 * Why `show()` rejected.
 *
 * `notLoaded` and `alreadyShown` are decided from the ad's own `status` before anything
 * reaches the SDK: Android has no readiness check at all (no `isReady`/`canShow`/`isLoaded`
 * anywhere in the Next-Gen SDK), so asking the SDK is not an option, and deciding it
 * ourselves makes both platforms behave identically.
 *
 * `failedToShow` comes from the SDK's own presentation failure callback.
 */
export type ShowAdErrorCode = 'notLoaded' | 'alreadyShown' | 'failedToShow';
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add full-screen ad types"
```

---

### Task 2: Shared JS helpers

**Files:**
- Create: `src/FullScreenAd.ts`
- Test: `src/FullScreenAd.test.ts`

**Interfaces:**
- Consumes: `FullScreenAdStatus`, `ShowAdErrorCode` (Task 1); `runWhenInitialized` from `src/initialization.ts`
- Produces:
  - `type FullScreenAdOptions = { adUnitId: string; requestOptions?: RequestOptions }`
  - `type FullScreenAdLike = { status: FullScreenAdStatus; load(): void; markLoadFailed(message: string): void }`
  - `isFullScreenAdReleased(ad: FullScreenAdLike): boolean`
  - `loadFullScreenAdWhenInitialized(ad: FullScreenAdLike): void`
  - `class ShowAdError extends Error { code: ShowAdErrorCode }`
  - `assertShowable(ad: FullScreenAdLike): void` — throws `ShowAdError` unless `status === 'loaded'`

`assertShowable` is the single place both formats decide `notLoaded` versus `alreadyShown`, so the two cannot drift apart.

- [ ] **Step 1: Write the failing test**

```typescript
import {
  ShowAdError,
  assertShowable,
  isFullScreenAdReleased,
  type FullScreenAdLike,
} from './FullScreenAd';

function makeAd(status: string): FullScreenAdLike {
  return { status, load: jest.fn(), markLoadFailed: jest.fn() } as unknown as FullScreenAdLike;
}

describe('assertShowable', () => {
  it('a loaded ad passes', () => {
    expect(() => assertShowable(makeAd('loaded'))).not.toThrow();
  });

  it('a loading ad is notLoaded', () => {
    expect(() => assertShowable(makeAd('loading'))).toThrow(
      expect.objectContaining({ code: 'notLoaded' })
    );
  });

  it('an errored ad is notLoaded', () => {
    expect(() => assertShowable(makeAd('error'))).toThrow(
      expect.objectContaining({ code: 'notLoaded' })
    );
  });

  it('a shown ad is alreadyShown, not notLoaded', () => {
    expect(() => assertShowable(makeAd('shown'))).toThrow(
      expect.objectContaining({ code: 'alreadyShown' })
    );
  });

  it('the thrown error is a ShowAdError with a message naming the status', () => {
    try {
      assertShowable(makeAd('loading'));
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ShowAdError);
      expect((e as Error).message).toContain('loading');
    }
  });
});

describe('isFullScreenAdReleased', () => {
  it('a live ad is not released', () => {
    expect(isFullScreenAdReleased(makeAd('loaded'))).toBe(false);
  });

  it('an ad whose property getter throws is released', () => {
    const ad = {
      get status(): string {
        throw new Error('SharedObject.NotFoundException');
      },
    } as unknown as FullScreenAdLike;
    expect(isFullScreenAdReleased(ad)).toBe(true);
  });

  it('an ad whose property getter returns undefined is released', () => {
    expect(isFullScreenAdReleased({ status: undefined } as unknown as FullScreenAdLike)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- FullScreenAd`
Expected: FAIL with "Cannot find module './FullScreenAd'"

- [ ] **Step 3: Implement**

```typescript
import { runWhenInitialized } from './initialization';
import type { FullScreenAdStatus, RequestOptions, ShowAdErrorCode } from './types';

export type FullScreenAdOptions = {
  adUnitId: string;
  requestOptions?: RequestOptions;
};

/**
 * The part of a full-screen ad these helpers need. Both `InterstitialAd` and `RewardedAd`
 * satisfy it, which is what lets them share one implementation of the `show()` guards.
 */
export type FullScreenAdLike = {
  readonly status: FullScreenAdStatus;
  load(): void;
  markLoadFailed(message: string): void;
};

/** Thrown by `show()`. `code` says which of the three failures happened. */
export class ShowAdError extends Error {
  readonly code: ShowAdErrorCode;

  constructor(code: ShowAdErrorCode, message: string) {
    super(message);
    this.name = 'ShowAdError';
    this.code = code;
  }
}

/**
 * @internal Whether `release()` has already severed this ad from its native object.
 *
 * Same mechanism as the banner's `isReleased`: a released shared object keeps reporting its
 * old `__expo_shared_object_id__`, so the id is not a usable signal, but every real property
 * getter throws `SharedObject.NotFoundException` once the registry entry is gone.
 */
export function isFullScreenAdReleased(ad: FullScreenAdLike): boolean {
  try {
    return ad.status === undefined;
  } catch {
    return true;
  }
}

/**
 * Starts loading once the SDK is initialized, or fails the ad if initialization failed.
 *
 * Mirrors the banner's `loadWhenInitialized`: an ad may be created before `initialize()`
 * resolves, and it must not be left on `loading` forever if initialization never succeeds.
 */
export function loadFullScreenAdWhenInitialized(ad: FullScreenAdLike): void {
  runWhenInitialized(
    () => {
      if (isFullScreenAdReleased(ad)) return;
      ad.load();
    },
    (error) => {
      if (isFullScreenAdReleased(ad)) return;
      const message = error instanceof Error ? error.message : String(error);
      ad.markLoadFailed(
        `Could not load the ad because Google Mobile Ads SDK initialization failed: ${message}`
      );
    }
  );
}

/**
 * Throws unless the ad can be shown right now.
 *
 * Deliberately does not wait for a loading ad. Showing a full-screen ad "as soon as it
 * finishes" makes it interrupt the user after they have moved on, which is the behaviour
 * Google's own policy guidance warns against. Check `isLoaded` and skip the ad instead.
 */
export function assertShowable(ad: FullScreenAdLike): void {
  const status = ad.status;
  if (status === 'loaded') return;
  if (status === 'shown') {
    throw new ShowAdError(
      'alreadyShown',
      'This ad has already been shown. Full-screen ads are single-use — create a new one.'
    );
  }
  throw new ShowAdError(
    'notLoaded',
    `The ad is not ready to show (status: ${status}). Check isLoaded before calling show().`
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- FullScreenAd`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/FullScreenAd.ts src/FullScreenAd.test.ts
git commit -m "feat: add shared helpers for full-screen ads"
```

---

### Task 3: InterstitialAd and RewardedAd (JS)

**Files:**
- Create: `src/InterstitialAd.ts`, `src/RewardedAd.ts`
- Test: `src/InterstitialAd.test.ts`, `src/RewardedAd.test.ts`
- Modify: `src/ExpoGoogleMobileAdsModule.ts`

**Interfaces:**
- Consumes: everything from Task 2; `AdReward`, `FullScreenAdStatus` (Task 1)
- Produces:
  - `createInterstitialAd(options: FullScreenAdOptions): InterstitialAd`
  - `createRewardedAd(options: FullScreenAdOptions): RewardedAd`
  - `declare class InterstitialAd extends SharedObject<FullScreenAdEvents>` with `status`, `error?`, `responseInfo?`, `load()`, `markLoadFailed()`, `showAsync(): Promise<void>`
  - `declare class RewardedAd extends SharedObject<RewardedAdEvents>` — same plus `reward?: AdReward` and `showAsync(): Promise<AdReward | null>`
  - `type FullScreenAdEvents`, `type RewardedAdEvents`

The native method is `showAsync` (Expo's `AsyncFunction` naming); the public JS API wraps it as `show()` so the guards in `assertShowable` always run first.

- [ ] **Step 1: Declare the native classes**

In `src/ExpoGoogleMobileAdsModule.ts`, add to the `declare class` body:

```typescript
  InterstitialAd: any;
  RewardedAd: any;
```

- [ ] **Step 2: Write the failing tests**

`src/InterstitialAd.test.ts`:

```typescript
const mockInterstitialAd = jest.fn();

jest.mock('./ExpoGoogleMobileAdsModule', () => ({
  __esModule: true,
  default: {
    get InterstitialAd() {
      return mockInterstitialAd;
    },
  },
}));

jest.mock('./initialization', () => ({ runWhenInitialized: jest.fn() }));

import { runWhenInitialized } from './initialization';
import { createInterstitialAd } from './InterstitialAd';

const mockRunWhenInitialized = runWhenInitialized as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockInterstitialAd.mockImplementation(function (this: any) {
    this.status = 'loading';
    this.load = jest.fn();
    this.showAsync = jest.fn().mockResolvedValue(undefined);
    this.markLoadFailed = jest.fn();
  });
});

describe('createInterstitialAd', () => {
  it('constructs the native ad with the ad unit id and request options', () => {
    const requestOptions = { keywords: ['game'] };
    createInterstitialAd({ adUnitId: 'unit', requestOptions });
    expect(mockInterstitialAd).toHaveBeenCalledWith('unit', requestOptions);
  });

  it('does not load directly — it defers until initialization completes', () => {
    const ad = createInterstitialAd({ adUnitId: 'unit' });
    expect((ad as any).load).not.toHaveBeenCalled();
    expect(mockRunWhenInitialized).toHaveBeenCalledTimes(1);
  });

  it('loads when the deferred task runs', () => {
    const ad = createInterstitialAd({ adUnitId: 'unit' });
    mockRunWhenInitialized.mock.calls[0][0]();
    expect((ad as any).load).toHaveBeenCalledTimes(1);
  });
});

describe('InterstitialAd.show', () => {
  it('rejects with notLoaded when the ad is still loading, without calling native', async () => {
    const ad = createInterstitialAd({ adUnitId: 'unit' });
    await expect(ad.show()).rejects.toMatchObject({ code: 'notLoaded' });
    expect((ad as any).showAsync).not.toHaveBeenCalled();
  });

  it('rejects with alreadyShown for an ad that was already shown', async () => {
    const ad = createInterstitialAd({ adUnitId: 'unit' });
    (ad as any).status = 'shown';
    await expect(ad.show()).rejects.toMatchObject({ code: 'alreadyShown' });
    expect((ad as any).showAsync).not.toHaveBeenCalled();
  });

  it('calls native showAsync for a loaded ad', async () => {
    const ad = createInterstitialAd({ adUnitId: 'unit' });
    (ad as any).status = 'loaded';
    await expect(ad.show()).resolves.toBeUndefined();
    expect((ad as any).showAsync).toHaveBeenCalledTimes(1);
  });

  it('surfaces a native presentation failure as failedToShow', async () => {
    const ad = createInterstitialAd({ adUnitId: 'unit' });
    (ad as any).status = 'loaded';
    (ad as any).showAsync = jest.fn().mockRejectedValue(new Error('presentation failed'));
    await expect(ad.show()).rejects.toMatchObject({ code: 'failedToShow' });
  });
});
```

`src/RewardedAd.test.ts`:

```typescript
const mockRewardedAd = jest.fn();

jest.mock('./ExpoGoogleMobileAdsModule', () => ({
  __esModule: true,
  default: {
    get RewardedAd() {
      return mockRewardedAd;
    },
  },
}));

jest.mock('./initialization', () => ({ runWhenInitialized: jest.fn() }));

import { createRewardedAd } from './RewardedAd';

beforeEach(() => {
  jest.clearAllMocks();
  mockRewardedAd.mockImplementation(function (this: any) {
    this.status = 'loading';
    this.load = jest.fn();
    this.showAsync = jest.fn().mockResolvedValue(null);
    this.markLoadFailed = jest.fn();
  });
});

describe('RewardedAd.show', () => {
  it('rejects with notLoaded when the ad is still loading', async () => {
    const ad = createRewardedAd({ adUnitId: 'unit' });
    await expect(ad.show()).rejects.toMatchObject({ code: 'notLoaded' });
  });

  it('resolves with the reward the native side reports', async () => {
    const ad = createRewardedAd({ adUnitId: 'unit' });
    (ad as any).status = 'loaded';
    (ad as any).showAsync = jest.fn().mockResolvedValue({ type: 'coins', amount: 10 });
    await expect(ad.show()).resolves.toEqual({ type: 'coins', amount: 10 });
  });

  it('resolves with null when the ad was dismissed without earning a reward', async () => {
    const ad = createRewardedAd({ adUnitId: 'unit' });
    (ad as any).status = 'loaded';
    (ad as any).showAsync = jest.fn().mockResolvedValue(null);
    await expect(ad.show()).resolves.toBeNull();
  });

  it('surfaces a native presentation failure as failedToShow', async () => {
    const ad = createRewardedAd({ adUnitId: 'unit' });
    (ad as any).status = 'loaded';
    (ad as any).showAsync = jest.fn().mockRejectedValue(new Error('presentation failed'));
    await expect(ad.show()).rejects.toMatchObject({ code: 'failedToShow' });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -- InterstitialAd RewardedAd`
Expected: FAIL with "Cannot find module './InterstitialAd'"

- [ ] **Step 4: Implement `src/InterstitialAd.ts`**

```typescript
import type { SharedObject } from 'expo-modules-core/types';

import NativeModule from './ExpoGoogleMobileAdsModule';
import {
  ShowAdError,
  assertShowable,
  loadFullScreenAdWhenInitialized,
  type FullScreenAdOptions,
} from './FullScreenAd';
import type { AdError, FullScreenAdStatus, PaidEventValue, ResponseInfo } from './types';

export type FullScreenAdEvents = {
  statusChange: (payload: { status: FullScreenAdStatus; error?: AdError }) => void;
  showed: () => void;
  dismissed: () => void;
  impression: () => void;
  clicked: () => void;
  paid: (payload: PaidEventValue) => void;
};

export declare class NativeInterstitialAd extends SharedObject<FullScreenAdEvents> {
  readonly status: FullScreenAdStatus;
  readonly error?: AdError;
  readonly responseInfo?: ResponseInfo;
  load(): void;
  /** @internal Reports a failure that happened before the ad could be loaded. */
  markLoadFailed(message: string): void;
  /** @internal Presents the ad. Use `show()`, which checks the ad is showable first. */
  showAsync(): Promise<void>;
}

export type InterstitialAd = NativeInterstitialAd & {
  /**
   * Presents the ad. Resolves when the user dismisses it.
   *
   * Rejects with a `ShowAdError` whose `code` is `notLoaded` (the ad is not ready — check
   * `isLoaded` first), `alreadyShown` (these ads are single-use), or `failedToShow` (the SDK
   * could not present it).
   */
  show(): Promise<void>;
};

function attachShow(ad: NativeInterstitialAd): InterstitialAd {
  const withShow = ad as InterstitialAd;
  withShow.show = async () => {
    assertShowable(withShow);
    try {
      await ad.showAsync();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ShowAdError('failedToShow', message);
    }
  };
  return withShow;
}

/**
 * Creates an interstitial ad and starts loading it. No view is involved, so this can be
 * called outside React — at app startup, or before a screen transition.
 *
 * The ad is single-use: after `show()` its status is `'shown'` and it cannot be reloaded.
 * Create a new one for the next impression.
 */
export function createInterstitialAd(options: FullScreenAdOptions): InterstitialAd {
  const ad: NativeInterstitialAd = new NativeModule.InterstitialAd(
    options.adUnitId,
    options.requestOptions
  );
  loadFullScreenAdWhenInitialized(ad);
  return attachShow(ad);
}
```

- [ ] **Step 5: Implement `src/RewardedAd.ts`**

```typescript
import type { SharedObject } from 'expo-modules-core/types';

import NativeModule from './ExpoGoogleMobileAdsModule';
import {
  ShowAdError,
  assertShowable,
  loadFullScreenAdWhenInitialized,
  type FullScreenAdOptions,
} from './FullScreenAd';
import type { FullScreenAdEvents } from './InterstitialAd';
import type { AdError, AdReward, FullScreenAdStatus, ResponseInfo } from './types';

export type RewardedAdEvents = FullScreenAdEvents & {
  earnedReward: (payload: AdReward) => void;
};

export declare class NativeRewardedAd extends SharedObject<RewardedAdEvents> {
  readonly status: FullScreenAdStatus;
  readonly error?: AdError;
  readonly responseInfo?: ResponseInfo;
  /**
   * What this ad offers, readable before it is shown so a prompt can say what the user will
   * get. Its presence does NOT mean the reward was earned — only `show()`'s resolved value
   * says that.
   */
  readonly reward?: AdReward;
  load(): void;
  /** @internal */
  markLoadFailed(message: string): void;
  /** @internal Use `show()`. */
  showAsync(): Promise<AdReward | null>;
}

export type RewardedAd = NativeRewardedAd & {
  /**
   * Presents the ad. Resolves with the earned reward when the user dismisses it, or `null`
   * if they dismissed it without earning one.
   *
   * Rejects with a `ShowAdError` whose `code` is `notLoaded`, `alreadyShown`, or
   * `failedToShow`.
   */
  show(): Promise<AdReward | null>;
};

function attachShow(ad: NativeRewardedAd): RewardedAd {
  const withShow = ad as RewardedAd;
  withShow.show = async () => {
    assertShowable(withShow);
    try {
      return await ad.showAsync();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ShowAdError('failedToShow', message);
    }
  };
  return withShow;
}

/**
 * Creates a rewarded ad and starts loading it. No view is involved, so this can be called
 * outside React.
 *
 * The ad is single-use: after `show()` its status is `'shown'`. Create a new one for the
 * next impression.
 */
export function createRewardedAd(options: FullScreenAdOptions): RewardedAd {
  const ad: NativeRewardedAd = new NativeModule.RewardedAd(
    options.adUnitId,
    options.requestOptions
  );
  loadFullScreenAdWhenInitialized(ad);
  return attachShow(ad);
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -- InterstitialAd RewardedAd`
Expected: PASS (11 tests)

- [ ] **Step 7: Type check and commit**

Run: `npx tsc --noEmit`

```bash
git add src/InterstitialAd.ts src/InterstitialAd.test.ts src/RewardedAd.ts src/RewardedAd.test.ts src/ExpoGoogleMobileAdsModule.ts
git commit -m "feat: add createInterstitialAd and createRewardedAd"
```

---

### Task 4: Hooks

**Files:**
- Create: `src/hooks/useInterstitialAd.ts`, `src/hooks/useRewardedAd.ts`
- Test: `src/hooks/useInterstitialAd.test.tsx`, `src/hooks/useRewardedAd.test.tsx`

**Interfaces:**
- Consumes: Task 3's creators and types
- Produces:
  - `useInterstitialAd(options): FullScreenAdState & { ad: InterstitialAd }`
  - `useInterstitialAdState(ad): FullScreenAdState`
  - `useRewardedAd(options): FullScreenAdState & { ad: RewardedAd }`
  - `useRewardedAdState(ad): FullScreenAdState`
  - `type FullScreenAdState = { isLoaded: boolean; error?: AdError }`

**Note on `@testing-library/react-native` 14.0.1:** `render`, `renderHook` and `rerender` all return Promises. **Await every one and make the enclosing tests `async`.** Follow `src/hooks/useBannerAd.test.tsx` for the existing convention.

- [ ] **Step 1: Write the failing test for `useInterstitialAd`**

```tsx
const mockUseReleasingSharedObject = jest.fn();
const mockUseEventListener = jest.fn();

jest.mock('expo', () => ({
  useEventListener: (...args: any[]) => mockUseEventListener(...args),
}));
jest.mock('expo-modules-core', () => ({
  useReleasingSharedObject: (...args: any[]) => mockUseReleasingSharedObject(...args),
}));
jest.mock('../ExpoGoogleMobileAdsModule', () => ({
  __esModule: true,
  default: { InterstitialAd: jest.fn() },
}));
jest.mock('../initialization', () => ({ runWhenInitialized: jest.fn() }));

import { renderHook } from '@testing-library/react-native';

import { useInterstitialAd, useInterstitialAdState } from './useInterstitialAd';

function makeAd(status = 'loading', error?: unknown) {
  return { status, error, load: jest.fn(), showAsync: jest.fn() } as any;
}

beforeEach(() => jest.clearAllMocks());

describe('useInterstitialAdState', () => {
  it('reports isLoaded false while loading', async () => {
    const { result } = await renderHook(() => useInterstitialAdState(makeAd('loading')));
    expect(result.current.isLoaded).toBe(false);
  });

  it('reports isLoaded true once loaded', async () => {
    const { result } = await renderHook(() => useInterstitialAdState(makeAd('loaded')));
    expect(result.current.isLoaded).toBe(true);
  });

  it('reports isLoaded false once shown', async () => {
    const { result } = await renderHook(() => useInterstitialAdState(makeAd('shown')));
    expect(result.current.isLoaded).toBe(false);
  });

  it('exposes the error', async () => {
    const error = { code: 3, message: 'No fill', domain: 'ExpoGoogleMobileAds' };
    const { result } = await renderHook(() => useInterstitialAdState(makeAd('error', error)));
    expect(result.current.error).toBe(error);
  });

  it('subscribes to statusChange on the ad', async () => {
    const ad = makeAd('loading');
    await renderHook(() => useInterstitialAdState(ad));
    expect(mockUseEventListener).toHaveBeenCalledWith(ad, 'statusChange', expect.any(Function));
  });

  it('resets its state when handed a different ad', async () => {
    const first = makeAd('loaded');
    const { result, rerender } = await renderHook((ad: any) => useInterstitialAdState(ad), {
      initialProps: first,
    });
    expect(result.current.isLoaded).toBe(true);

    await rerender(makeAd('loading'));

    expect(result.current.isLoaded).toBe(false);
  });

  it('does not create an ad', async () => {
    await renderHook(() => useInterstitialAdState(makeAd('loaded')));
    expect(mockUseReleasingSharedObject).not.toHaveBeenCalled();
  });
});

describe('useInterstitialAd', () => {
  it('creates the ad through useReleasingSharedObject and returns it', async () => {
    const ad = makeAd('loading');
    mockUseReleasingSharedObject.mockReturnValue(ad);

    const { result } = await renderHook(() => useInterstitialAd({ adUnitId: 'unit' }));

    expect(mockUseReleasingSharedObject).toHaveBeenCalledTimes(1);
    expect(result.current.ad).toBe(ad);
  });

  it('keys the ad on the ad unit id', async () => {
    mockUseReleasingSharedObject.mockReturnValue(makeAd('loading'));
    await renderHook(() => useInterstitialAd({ adUnitId: 'unit' }));
    expect(mockUseReleasingSharedObject.mock.calls[0][1]).toEqual(['unit']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- useInterstitialAd`
Expected: FAIL with "Cannot find module './useInterstitialAd'"

- [ ] **Step 3: Implement `src/hooks/useInterstitialAd.ts`**

```typescript
import { useEventListener } from 'expo';
import { useReleasingSharedObject } from 'expo-modules-core';
import { useState } from 'react';

import type { FullScreenAdOptions } from '../FullScreenAd';
import { isFullScreenAdReleased, loadFullScreenAdWhenInitialized } from '../FullScreenAd';
import NativeModule from '../ExpoGoogleMobileAdsModule';
import type { InterstitialAd, NativeInterstitialAd } from '../InterstitialAd';
import type { AdError } from '../types';

export type FullScreenAdState = {
  isLoaded: boolean;
  error?: AdError;
};

function readState(ad: { status?: string; error?: AdError }): FullScreenAdState {
  if (isFullScreenAdReleased(ad as never)) {
    return { isLoaded: false };
  }
  return { isLoaded: ad.status === 'loaded', error: ad.error };
}

/**
 * Subscribes to an ad the caller already owns (for example one preloaded at app startup with
 * `createInterstitialAd`). Does not create or release it.
 *
 * The state is keyed on the ad instance. `useEvent` cannot be used: its `initialValue` is only
 * `useState`'s initial argument, so state from a previous ad would carry over — `isLoaded`
 * would stay true while a freshly created ad is still loading. Resetting during render is
 * React's own answer to that.
 */
export function useInterstitialAdState(ad: InterstitialAd): FullScreenAdState {
  const [state, setState] = useState(() => readState(ad));
  const [stateOwner, setStateOwner] = useState(ad);

  if (stateOwner !== ad) {
    setStateOwner(ad);
    setState(readState(ad));
  }

  useEventListener(ad, 'statusChange', () => setState(readState(ad)));

  return state;
}

/**
 * Creates an interstitial ad and releases it on unmount.
 *
 * `requestOptions` is only read at creation time; changing it later has no effect. Call the
 * hook again with a different `adUnitId` to get a new ad.
 */
export function useInterstitialAd(
  options: FullScreenAdOptions
): FullScreenAdState & { ad: InterstitialAd } {
  const ad = useReleasingSharedObject<NativeInterstitialAd>(() => {
    const created: NativeInterstitialAd = new NativeModule.InterstitialAd(
      options.adUnitId,
      options.requestOptions
    );
    loadFullScreenAdWhenInitialized(created);
    return created;
  }, [options.adUnitId]) as InterstitialAd;

  return { ...useInterstitialAdState(ad), ad };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- useInterstitialAd`
Expected: PASS (9 tests)

- [ ] **Step 5: Write the failing test for `useRewardedAd`**

`src/hooks/useRewardedAd.test.tsx`:

```tsx
const mockUseReleasingSharedObject = jest.fn();
const mockUseEventListener = jest.fn();

jest.mock('expo', () => ({
  useEventListener: (...args: any[]) => mockUseEventListener(...args),
}));
jest.mock('expo-modules-core', () => ({
  useReleasingSharedObject: (...args: any[]) => mockUseReleasingSharedObject(...args),
}));
jest.mock('../ExpoGoogleMobileAdsModule', () => ({
  __esModule: true,
  default: { RewardedAd: jest.fn() },
}));
jest.mock('../initialization', () => ({ runWhenInitialized: jest.fn() }));

import { renderHook } from '@testing-library/react-native';

import { useRewardedAd, useRewardedAdState } from './useRewardedAd';

function makeAd(status = 'loading', error?: unknown) {
  return { status, error, load: jest.fn(), showAsync: jest.fn() } as any;
}

beforeEach(() => jest.clearAllMocks());

describe('useRewardedAdState', () => {
  it('reports isLoaded false while loading', async () => {
    const { result } = await renderHook(() => useRewardedAdState(makeAd('loading')));
    expect(result.current.isLoaded).toBe(false);
  });

  it('reports isLoaded true once loaded', async () => {
    const { result } = await renderHook(() => useRewardedAdState(makeAd('loaded')));
    expect(result.current.isLoaded).toBe(true);
  });

  it('reports isLoaded false once shown', async () => {
    const { result } = await renderHook(() => useRewardedAdState(makeAd('shown')));
    expect(result.current.isLoaded).toBe(false);
  });

  it('exposes the error', async () => {
    const error = { code: 3, message: 'No fill', domain: 'ExpoGoogleMobileAds' };
    const { result } = await renderHook(() => useRewardedAdState(makeAd('error', error)));
    expect(result.current.error).toBe(error);
  });

  it('subscribes to statusChange on the ad', async () => {
    const ad = makeAd('loading');
    await renderHook(() => useRewardedAdState(ad));
    expect(mockUseEventListener).toHaveBeenCalledWith(ad, 'statusChange', expect.any(Function));
  });

  it('resets its state when handed a different ad', async () => {
    const first = makeAd('loaded');
    const { result, rerender } = await renderHook((ad: any) => useRewardedAdState(ad), {
      initialProps: first,
    });
    expect(result.current.isLoaded).toBe(true);

    await rerender(makeAd('loading'));

    expect(result.current.isLoaded).toBe(false);
  });

  it('does not create an ad', async () => {
    await renderHook(() => useRewardedAdState(makeAd('loaded')));
    expect(mockUseReleasingSharedObject).not.toHaveBeenCalled();
  });

  it('does not surface the offered reward in the hook state', async () => {
    const ad = makeAd('loaded');
    ad.reward = { type: 'coins', amount: 10 };

    const { result } = await renderHook(() => useRewardedAdState(ad));

    expect(result.current.isLoaded).toBe(true);
    // The offered reward stays on the ad. The hook reports load state only, so nothing it
    // returns can be mistaken for "the user earned this" — only show()'s resolved value
    // says that.
    expect((result.current as any).reward).toBeUndefined();
  });
});

describe('useRewardedAd', () => {
  it('creates the ad through useReleasingSharedObject and returns it', async () => {
    const ad = makeAd('loading');
    mockUseReleasingSharedObject.mockReturnValue(ad);

    const { result } = await renderHook(() => useRewardedAd({ adUnitId: 'unit' }));

    expect(mockUseReleasingSharedObject).toHaveBeenCalledTimes(1);
    expect(result.current.ad).toBe(ad);
  });

  it('keys the ad on the ad unit id', async () => {
    mockUseReleasingSharedObject.mockReturnValue(makeAd('loading'));
    await renderHook(() => useRewardedAd({ adUnitId: 'unit' }));
    expect(mockUseReleasingSharedObject.mock.calls[0][1]).toEqual(['unit']);
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npm test -- useRewardedAd`
Expected: FAIL with "Cannot find module './useRewardedAd'"

- [ ] **Step 7: Implement `src/hooks/useRewardedAd.ts`**

```typescript
import { useEventListener } from 'expo';
import { useReleasingSharedObject } from 'expo-modules-core';
import { useState } from 'react';

import type { FullScreenAdOptions } from '../FullScreenAd';
import { isFullScreenAdReleased, loadFullScreenAdWhenInitialized } from '../FullScreenAd';
import NativeModule from '../ExpoGoogleMobileAdsModule';
import type { NativeRewardedAd, RewardedAd } from '../RewardedAd';
import type { AdError } from '../types';
import type { FullScreenAdState } from './useInterstitialAd';

function readState(ad: { status?: string; error?: AdError }): FullScreenAdState {
  if (isFullScreenAdReleased(ad as never)) {
    return { isLoaded: false };
  }
  return { isLoaded: ad.status === 'loaded', error: ad.error };
}

/**
 * Subscribes to a rewarded ad the caller already owns. Does not create or release it.
 *
 * Reports load state only. The reward the ad offers stays on `ad.reward`, and whether the
 * user actually earned it comes solely from `show()`'s resolved value — keeping those apart
 * is what stops a caller from granting a reward nobody earned.
 *
 * The state is keyed on the ad instance, for the same reason as `useInterstitialAdState`:
 * `useEvent`'s `initialValue` is only `useState`'s initial argument, so state from a previous
 * ad would otherwise carry over.
 */
export function useRewardedAdState(ad: RewardedAd): FullScreenAdState {
  const [state, setState] = useState(() => readState(ad));
  const [stateOwner, setStateOwner] = useState(ad);

  if (stateOwner !== ad) {
    setStateOwner(ad);
    setState(readState(ad));
  }

  useEventListener(ad, 'statusChange', () => setState(readState(ad)));

  return state;
}

/**
 * Creates a rewarded ad and releases it on unmount.
 *
 * `requestOptions` is only read at creation time; changing it later has no effect. Call the
 * hook again with a different `adUnitId` to get a new ad.
 */
export function useRewardedAd(
  options: FullScreenAdOptions
): FullScreenAdState & { ad: RewardedAd } {
  const ad = useReleasingSharedObject<NativeRewardedAd>(() => {
    const created: NativeRewardedAd = new NativeModule.RewardedAd(
      options.adUnitId,
      options.requestOptions
    );
    loadFullScreenAdWhenInitialized(created);
    return created;
  }, [options.adUnitId]) as RewardedAd;

  return { ...useRewardedAdState(ad), ad };
}
```

Note that `FullScreenAdState` is imported from `./useInterstitialAd` rather than redeclared, and that **`reward` is deliberately not part of it**.

- [ ] **Step 8: Run it to verify it passes**

Run: `npm test -- useRewardedAd`
Expected: PASS (10 tests)

- [ ] **Step 9: Commit**

```bash
git add src/hooks/useInterstitialAd.ts src/hooks/useInterstitialAd.test.tsx src/hooks/useRewardedAd.ts src/hooks/useRewardedAd.test.tsx
git commit -m "feat: add hooks for interstitial and rewarded ads"
```

---

### Task 5: Public exports

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Add the exports**

```typescript
export { createInterstitialAd } from './InterstitialAd';
export type { InterstitialAd, FullScreenAdEvents } from './InterstitialAd';

export { createRewardedAd } from './RewardedAd';
export type { RewardedAd, RewardedAdEvents } from './RewardedAd';

export { ShowAdError } from './FullScreenAd';
export type { FullScreenAdOptions } from './FullScreenAd';

export { useInterstitialAd, useInterstitialAdState } from './hooks/useInterstitialAd';
export type { FullScreenAdState } from './hooks/useInterstitialAd';
export { useRewardedAd, useRewardedAdState } from './hooks/useRewardedAd';
```

Add `AdReward`, `FullScreenAdStatus` and `ShowAdErrorCode` to the existing `export type { ... } from './types'` block.

`ShowAdError` is exported as a value, not just a type, so callers can use `instanceof`.

- [ ] **Step 2: Verify the export list matches reality**

Run: `npx tsc --noEmit && npm test`
Expected: clean, all tests pass

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: export the full-screen ad API"
```

---

### Task 6: iOS native implementation

**Files:**
- Create: `ios/FullScreenAd.swift`, `ios/InterstitialAd.swift`, `ios/RewardedAd.swift`
- Modify: `ios/ExpoGoogleMobileAdsModule.swift`

**Interfaces:**
- Produces the native side of the JS contract from Task 3: constructor `(adUnitId, requestOptions)`; properties `status`, `error`, `responseInfo`, and `reward` on rewarded; methods `load()`, `markLoadFailed(message)`, `showAsync()`; events `statusChange`, `showed`, `dismissed`, `impression`, `clicked`, `paid`, and `earnedReward` on rewarded.

**Read `.superpowers/sdd/phase2-api-recon.md` first.** Every signature there is quoted from the installed pod headers. Four things in it contradict Google's public documentation — trust the recon.

**Why this task and Task 7 state requirements instead of supplying code.** In phase 1 the plan carried Swift and Kotlin written from Google's documentation, and it disagreed with the real SDKs in roughly nine places per platform — every one cost a fix round. Speculative native code in a plan is worse than none, because an implementer tends to make it compile rather than question it. The recon report has the real signatures; write against those and the existing banner implementation, and report anything that still differs.

- [ ] **Step 1: Read the recon and the existing banner implementation**

Read `.superpowers/sdd/phase2-api-recon.md`, then `ios/BannerAd.swift` and `ios/ExpoGoogleMobileAdsModule.swift`. The banner is the reference for: the `runOnMain` helper and where it is and is not used, the `NSObject` delegate-proxy pattern (a `SharedObject` cannot conform to a GMA delegate directly), `NSLock`-guarded state, and the async release teardown.

- [ ] **Step 2: Implement the shared base in `ios/FullScreenAd.swift`**

It must handle:

- **Presenting on the main thread** with a view controller resolved *at show time* via `appContext?.utilities?.currentViewController()`, never cached at construction.
- **Settling the promise from three places**: `adDidDismissFullScreenContent` resolves; `ad(_:didFailToPresentFullScreenContentWithError:)` rejects; and if the ad is somehow gone, reject rather than leave the promise pending. **A failed presentation never dismisses, so resolving only on dismiss leaves the promise pending forever.**
- **Status transitions**: `loaded` → `shown` when presentation starts; `error` on a presentation failure.
- Events `showed` (from `adWillPresentFullScreenContent` — note `adDidPresentFullScreenContent:` is `NS_UNAVAILABLE` in 13.7.0 and will not compile), `dismissed`, `impression`, `clicked`, and `paid` (from the `paidEventHandler` **closure property**, not a delegate method).
- Release teardown that clears `fullScreenContentDelegate`, `paidEventHandler`, and any retained promise, posted asynchronously — Expo calls the release hook while holding the registry lock.

- [ ] **Step 3: Implement `ios/InterstitialAd.swift`**

Load with `InterstitialAd.load(with:request:completionHandler:)`. On success store the ad and move to `loaded`; on failure move to `error` and emit `statusChange`.

- [ ] **Step 4: Implement `ios/RewardedAd.swift` — the earned-reward latch**

Load the same way. Present with `present(from:userDidEarnRewardHandler:)`.

**The handler takes no parameters.** `GADUserDidEarnRewardHandler` is `void(^)(void)`, and `adReward` is populated *before* the ad is shown, so a non-nil `adReward` does **not** mean the user earned anything.

So: set a `didEarnReward` flag when the handler fires, and when the ad is dismissed resolve with `adReward` only if that flag is set, otherwise `nil`. Emit `earnedReward` from the handler too.

Getting this wrong grants a reward to a user who dismissed the ad without watching it.

- [ ] **Step 5: Register both classes in `ios/ExpoGoogleMobileAdsModule.swift`**

Follow the existing `Class(BannerAd.self)` block: `Constructor`, `Property` for each field, `Function("load")`, `Function("markLoadFailed")`, and `AsyncFunction("showAsync")`.

Note that `Events(...)` does not compile inside a `Class(...)` block in this expo-modules-core version, and is not needed — `emit` requires no pre-registration.

- [ ] **Step 6: Build and verify the module actually recompiled**

```bash
D=~/Library/Developer/Xcode/DerivedData/expogooglemobileadsexample-*
rm -rf $D/Build/Intermediates.noindex/Pods.build/Debug-iphonesimulator/ExpoGoogleMobileAds.build
rm -rf $D/Build/Products/Debug-iphonesimulator/ExpoGoogleMobileAds
cd example && npx expo run:ios --device "DE3572EA-B1F3-40D1-B440-3403C07CBA43"
```

Expected: 0 errors. **Confirm the warning count is non-zero** — the known baseline is 5 deprecated-API warnings from the module (a 6th linker note only appears on a full project link). A report of 0 warnings means the module was not recompiled and the result is meaningless.

- [ ] **Step 7: Commit**

```bash
git add ios/
git commit -m "feat: add the iOS full-screen ad implementation"
```

---

### Task 7: Android native implementation

**Files:**
- Create: `android/src/main/java/expo/modules/googlemobileads/FullScreenAd.kt`, `InterstitialAd.kt`, `RewardedAd.kt`
- Modify: `android/src/main/java/expo/modules/googlemobileads/ExpoGoogleMobileAdsModule.kt`

**Interfaces:**
- Produces the identical JS contract to Task 6. **Read `ios/*.swift` from Task 6 as the reference for behaviour** — the idioms differ but the observable behaviour must not.

- [ ] **Step 1: Read the recon and the existing banner implementation**

Read `.superpowers/sdd/phase2-api-recon.md`, then `android/.../BannerAd.kt` and `ExpoGoogleMobileAdsModule.kt`. The banner is the reference for the `runOnMain` helper, the immutable `@Volatile` state snapshot, per-call Activity resolution, and the asynchronously-posted release teardown.

- [ ] **Step 2: Implement the shared base in `FullScreenAd.kt`**

Same responsibilities as the iOS base, with these Android specifics:

- `show(Activity)` needs a **non-null** Activity, and `appContext.currentActivity` is nullable. Resolve it at show time and, if it is null, settle the promise with a real error rather than crashing or failing silently. **This is an Android-only failure path** — iOS takes a nullable view controller.
- Events: `showed` from `onAdShowedFullScreenContent`, `dismissed` from `onAdDismissedFullScreenContent`, `impression` from `onAdImpression`, `clicked` from `onAdClicked`, `paid` from `onAdPaid(AdValue)`. **Android has no will-dismiss callback**, which is why iOS's `adWillDismissFullScreenContent` is deliberately unused.
- Convert `AdValue`'s micros to the same `PaidEventValue` shape the banner already emits, so the two platforms agree.
- Release teardown must clear the callbacks **and** call `destroy()`.

- [ ] **Step 3: Implement `InterstitialAd.kt`**

Load with the static `InterstitialAd.load(AdRequest, AdLoadCallback<InterstitialAd>)`.

**Note:** there is no `InterstitialAdRequest`. Unlike the banner's `BannerAdRequest.Builder`, this takes the common `AdRequest.Builder(adUnitId)`.

- [ ] **Step 4: Implement `RewardedAd.kt`**

Load with `RewardedAd.load(AdRequest, AdLoadCallback<RewardedAd>)`; show with `show(Activity, OnUserEarnedRewardListener)`.

Android hands the reward over directly: `onUserEarnedReward(RewardItem)` with `getType(): String` and `getAmount(): Int`. Store it, emit the `earnedReward` event from the listener, and resolve the promise with it on dismiss; resolve with `null` if the listener never fired.

The observable result must match iOS exactly, even though iOS gets there by latching a zero-argument handler.

- [ ] **Step 5: Register both classes in `ExpoGoogleMobileAdsModule.kt`**

Follow the existing `Class(BannerAd::class)` block.

- [ ] **Step 6: Build and verify the module actually recompiled**

```bash
cd example && npx expo run:android
```

Force a clean module recompile first (`./gradlew :expo-google-mobile-ads:clean` from `example/android`, or `--rerun-tasks`) and say in the report that you did. Expected: 0 errors, and a **non-zero** warning count — the baseline is 9. Zero warnings means the module was not rebuilt.

- [ ] **Step 7: Commit**

```bash
git add android/
git commit -m "feat: add the Android full-screen ad implementation"
```

---

### Task 8: Example app and manual QA

**Files:**
- Modify: `example/App.tsx`, `example/QA.md`

**Interfaces:**
- Consumes: the whole public API

This is the first time the full-screen path runs end to end. Nothing before this proves an ad actually presents.

- [ ] **Step 1: Add the UI**

Add buttons for: preload an interstitial outside React and show it; a hook-created interstitial; the same two for rewarded; show an ad that is still loading; show an already-shown ad; and a rewarded ad dismissed without earning.

Display each ad's `status`, and for rewarded display `ad.reward` labelled clearly as *offered*, not earned.

Use the test ad units from the Global Constraints.

- [ ] **Step 2: Write the QA checklist into `example/QA.md`**

Add a full-screen section covering, per platform:

1. A preloaded interstitial presents and `show()` resolves on dismiss.
2. `status` goes `loading` → `loaded` → `shown`.
3. `show()` on a still-loading ad rejects with `notLoaded` **without presenting anything**.
4. `show()` on an already-shown ad rejects with `alreadyShown`.
5. A rewarded ad watched to completion resolves with `{type, amount}` and emits `earnedReward`.
6. **A rewarded ad dismissed early resolves with `null`** — this is the iOS latch. Getting it wrong grants an unearned reward, so check it on iOS specifically.
7. Events `showed`, `dismissed`, `impression` and `paid` all fire, on both platforms.
8. Backgrounding the app while an ad is on screen and returning does not wedge the promise.
9. Creating an ad before `initialize()` resolves still loads once initialization completes.
10. A failed presentation rejects with `failedToShow` and **does not leave the promise pending**.

- [ ] **Step 3: Run every item on both platforms and record real results**

Record the actual outcome of each item on each platform, including failures. **Do not fix native bugs found here** — report them precisely (what you did, what happened, what you expected, the relevant log lines).

Use `adb logcat` and the iOS simulator log, not just the screen.

- [ ] **Step 4: Commit**

```bash
git add example/
git commit -m "feat: add full-screen ads to the example app and QA checklist"
```

---

### Task 9: Documentation

**Files:**
- Modify: `README.md`, `README.ja.md`

Both files must stay in sync; every change goes into both.

- [ ] **Step 1: Document the API**

Cover:

- `createInterstitialAd` / `createRewardedAd` and the preload-outside-React pattern
- the four hooks, with the ownership distinction stated as it is for banners
- **one-shot semantics**: `'shown'` is terminal, create a new ad for the next impression
- `show()`'s Promise: resolves on dismiss, and for rewarded resolves with the reward or `null`
- `show()` rejecting with `ShowAdError` and its three codes, **with the reason it does not wait** — showing an ad "as soon as it loads" interrupts a user who has moved on, which Google's policy guidance warns against; check `isLoaded` and skip instead
- **`ad.reward` is what the ad offers, not proof it was earned.** Only `show()`'s resolved value says the user earned it. Say this plainly; getting it wrong grants unearned rewards.
- what is still not included: UMP consent, native ads, app-open ads, and server-side verification

- [ ] **Step 2: Reconcile the API reference list against `src/index.ts`**

The README's export list mirrors the public surface. Check every line against the real file in both directions.

- [ ] **Step 3: Commit**

```bash
git add README.md README.ja.md
git commit -m "docs: document interstitial and rewarded ads"
```
