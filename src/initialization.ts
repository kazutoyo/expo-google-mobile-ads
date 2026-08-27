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
 */
export function runWhenInitialized(task: () => void): void {
  if (__DEV__ && !queue.isInitializeCalled()) {
    console.warn(
      '[expo-google-mobile-ads] initialize() has not been called, so the ad load will not start. ' +
        'Call initialize() when your app starts.'
    );
  }
  queue.run(task);
}

/** @internal Test-only */
export function __resetForTesting(): void {
  queue = createInitializationQueue();
  pendingInitialization = null;
}
