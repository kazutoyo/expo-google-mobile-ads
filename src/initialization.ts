import NativeModule from './ExpoGoogleMobileAdsModule';
import { createInitializationQueue } from './initializationQueue';
import type { InitializationStatus, RequestConfiguration } from './types';

let queue = createInitializationQueue();
let pendingInitialization: Promise<InitializationStatus> | null = null;

/**
 * Initializes the Google Mobile Ads SDK. Call this once before loading any ads.
 *
 * The ordering with UMP consent collection is the app's decision — this library
 * does not auto-initialize.
 */
export function initialize(): Promise<InitializationStatus> {
  queue.markInitializeCalled();

  if (!pendingInitialization) {
    pendingInitialization = NativeModule.initializeAsync().then(
      (status) => {
        queue.resolve();
        return status;
      },
      (error) => {
        // Clear the cache before rethrowing so the next initialize() call can retry.
        pendingInitialization = null;
        // Tell everything already queued that initialization failed. Without this the failure
        // only ever reaches whoever awaited initialize(), and every ad created beforehand
        // stays `loading` forever with no error of its own.
        queue.reject(error);
        throw error;
      }
    );
  }

  return pendingInitialization;
}

export function setRequestConfiguration(config: RequestConfiguration): void {
  NativeModule.setRequestConfiguration(config);
}

/**
 * Runs a task once initialization completes. Runs immediately if already complete.
 *
 * `onInitializationError` is called instead of the task when initialization fails, so the
 * caller can surface the failure. The task itself is never run in that case — nothing may load
 * against an SDK that failed to initialize.
 */
export function runWhenInitialized(
  task: () => void,
  onInitializationError: (error: unknown) => void
): void {
  if (__DEV__ && !queue.isInitializeCalled()) {
    console.warn(
      '[expo-google-mobile-ads] initialize() has not been called, so the ad load will not start. ' +
        'Call initialize() when your app starts.'
    );
  }
  queue.run(task, onInitializationError);
}

/** @internal Test-only */
export function __resetForTesting(): void {
  queue = createInitializationQueue();
  pendingInitialization = null;
}
