import type { SharedObject } from 'expo-modules-core/types';

import type { BannerAdSize } from './BannerAdSize';
import NativeModule from './ExpoGoogleMobileAdsModule';
import { runWhenInitialized } from './initialization';
import type {
  AdError,
  BannerAdStatus,
  PaidEventValue,
  RequestOptions,
  ResponseInfo,
} from './types';

export type BannerAdEvents = {
  statusChange: (payload: { status: BannerAdStatus; error?: AdError }) => void;
  impression: () => void;
  clicked: () => void;
  paid: (payload: PaidEventValue) => void;
};

export declare class BannerAd extends SharedObject<BannerAdEvents> {
  /** The requested size. Used to reserve space before the ad loads. */
  readonly size: BannerAdSize;
  readonly status: BannerAdStatus;
  readonly error?: AdError;
  readonly loadedSize?: BannerAdSize;
  readonly responseInfo?: ResponseInfo;
  /** Used to retry after a failure or to reload manually. */
  load(): void;
  /**
   * @internal Reports a failure that happened before the ad could even be loaded (currently
   * only "the SDK failed to initialize"). Moves the ad to `status: 'error'` and emits
   * `statusChange`, so consumers aren't left waiting on `loading` forever.
   */
  markLoadFailed(message: string): void;
  // release() and addListener() are inherited from SharedObject
}

/**
 * The registry id to hand the native view, or `null` if there isn't one.
 *
 * In `__DEV__`, React Native deep-freezes every prop value it gives to a native view
 * (`ReactFabric-dev.js` -> `deepFreezeAndThrowOnMutationInDev`, which calls `Object.freeze` +
 * `Object.seal`). A frozen `SharedObject` can no longer have its internal native-state property
 * re-defined, so a later `ad.release()` throws "Exception in HostFunction: failed to define
 * internal native state property" from Hermes and crashes the app. `useBannerAd` releases the
 * old ad whenever `adUnitId` or `size` changes, so an ordinary device rotation used to crash. A
 * number cannot be frozen, so passing the id keeps `release()` working. Native still receives a
 * `BannerAd` — expo-modules-core converts the id back through the shared object registry.
 * `expo-video` passes `player.__expo_shared_object_id__` to `VideoView` the same way.
 *
 * `__expo_shared_object_id__` is an internal, deprecated property (see
 * `NativeViewManagerAdapter.native.tsx`'s own `typeof` guard around the identical access). If it
 * ever stops being set, an unguarded read returns `undefined`, so guard the type and fall back
 * to `null`, matching `expo-video`'s `getPlayerId`. `0` is rejected for the same reason: ids are
 * handed out starting at 1, so it could only mean "gone".
 *
 * Note this is NOT a released check — see `isReleased`.
 *
 * @internal
 */
export function sharedObjectIdOf(ad: BannerAd): number | null {
  // @ts-expect-error internal property installed by expo-modules-core on every SharedObject
  const sharedObjectId = ad.__expo_shared_object_id__;
  if (typeof sharedObjectId !== 'number' || sharedObjectId === 0) {
    return null;
  }
  return sharedObjectId;
}

/**
 * @internal Whether `release()` has already severed this ad from its native object.
 *
 * Probing a property is the only reliable signal. `release()` deletes the shared object's
 * registry entry, but the JS object keeps reporting its old `__expo_shared_object_id__`:
 * `SharedObject.cpp` clears the native state with `setNativeState(runtime, nullptr)`, and on
 * Hermes that does not make `hasNativeState` false, so the getter still finds the old
 * `objectId` and returns it. Verified on device (expo-modules-core 57.0.14, iOS simulator):
 * after `release()` the id still reads back unchanged, while `ad.status` and `ad.size` throw.
 * The mechanism is in shared C++, so it is not iOS-specific.
 *
 * Every real property getter, by contrast, goes through `DynamicSharedObjectType.cast`, which
 * raises `SharedObject.NotFoundException` as soon as the registry entry is gone. Unguarded,
 * that propagates straight out of whatever React render read it.
 */
export function isReleased(ad: BannerAd): boolean {
  try {
    // Any property would do; `status` is the cheapest. A live ad always has one, so a missing
    // value means gone just as much as a throw does.
    const status: BannerAdStatus | undefined = ad.status;
    return status === undefined;
  } catch {
    return true;
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Starts loading `ad` once the SDK has finished initializing.
 *
 * Both guards matter. The ad may be released before initialization completes — `useBannerAd`
 * releases it on unmount or on a dependency change, and a cold-start `initialize()` takes about
 * a second — and calling `load()` on a released ad throws out of the promise callback that is
 * draining the queue, which would also strand every task queued behind it. And if
 * initialization fails outright, the ad must not load, but it must still learn that it never
 * will.
 *
 * @internal
 */
export function loadWhenInitialized(ad: BannerAd): void {
  runWhenInitialized(
    () => {
      if (isReleased(ad)) return;
      ad.load();
    },
    (error) => {
      if (isReleased(ad)) return;
      ad.markLoadFailed(
        `Could not load the ad because Google Mobile Ads SDK initialization failed: ${messageOf(error)}`
      );
    }
  );
}

export type BannerAdOptions = {
  adUnitId: string;
  size: BannerAdSize;
  requestOptions?: RequestOptions;
};

/**
 * Creates a banner ad and starts loading it. No View is required.
 *
 * If the SDK hasn't finished initializing yet, the load is deferred until it does.
 */
export function createBannerAd(options: BannerAdOptions): BannerAd {
  const ad: BannerAd = new NativeModule.BannerAd(
    options.adUnitId,
    options.size,
    options.requestOptions
  );

  loadWhenInitialized(ad);

  return ad;
}
