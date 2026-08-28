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

/**
 * Thrown by `show()`. `code` says which of the three failures happened.
 *
 * For `failedToShow`, `cause` is the original error the native side rejected with — `code` and
 * `message` are the documented surface consumers branch on, but `cause` keeps programmatic access
 * to the SDK's own error (e.g. to tell iOS's `AdAlreadyUsed` apart from a genuine presentation
 * failure) for anyone who needs it.
 */
export class ShowAdError extends Error {
  readonly code: ShowAdErrorCode;

  constructor(code: ShowAdErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
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
