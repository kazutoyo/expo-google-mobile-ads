import NativeModule from './ExpoGoogleMobileAdsModule';
import { createInitializationQueue } from './initializationQueue';
import type { InitializationStatus, RequestConfiguration } from './types';

let queue = createInitializationQueue();
let pendingInitialization: Promise<InitializationStatus> | null = null;

/**
 * Google Mobile Ads SDK を初期化する。広告をロードする前に一度だけ呼ぶ。
 *
 * UMP による同意取得との順序はアプリ側が決める。ライブラリは自動初期化しない。
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
        // 失敗を次回の initialize() で再試行できるよう、キャッシュをクリアしてから再送出する。
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
 * 初期化完了後にタスクを実行する。完了済みなら即座に実行する。
 */
export function runWhenInitialized(task: () => void): void {
  if (__DEV__ && !queue.isInitializeCalled()) {
    console.warn(
      '[expo-google-mobile-ads] initialize() が呼ばれていないため広告のロードが開始されません。' +
        'アプリの起動時に initialize() を呼んでください。'
    );
  }
  queue.run(task);
}

/** @internal テスト専用 */
export function __resetForTesting(): void {
  queue = createInitializationQueue();
  pendingInitialization = null;
}
