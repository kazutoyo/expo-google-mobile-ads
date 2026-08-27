/** A task waiting for the SDK to finish initializing, plus how to report a failed one. */
type PendingTask = {
  task: () => void;
  /** Called instead of `task` when initialization fails. */
  onInitializationError: (error: unknown) => void;
};

export type InitializationQueue = {
  markInitializeCalled(): void;
  isInitializeCalled(): boolean;
  resolve(): void;
  /**
   * Reports a failed initialization to everything queued so far. Queued tasks are deliberately
   * NOT run — nothing may load against an SDK that failed to initialize — but they must not be
   * dropped silently either, or the ad they belong to stays `loading` forever with no error
   * anywhere. The queue itself stays open, so a later successful `initialize()` still runs
   * whatever is queued after this point.
   */
  reject(error: unknown): void;
  run(task: () => void, onInitializationError: (error: unknown) => void): void;
};

export function createInitializationQueue(): InitializationQueue {
  let initializeCalled = false;
  let resolved = false;
  let pending: PendingTask[] = [];

  return {
    markInitializeCalled() {
      initializeCalled = true;
    },
    isInitializeCalled() {
      return initializeCalled;
    },
    resolve() {
      if (resolved) return;
      resolved = true;
      const tasks = pending;
      pending = [];
      tasks.forEach(({ task }) => task());
    },
    reject(error) {
      if (resolved) return;
      const tasks = pending;
      pending = [];
      tasks.forEach(({ onInitializationError }) => onInitializationError(error));
    },
    run(task, onInitializationError) {
      if (resolved) {
        task();
        return;
      }
      pending.push({ task, onInitializationError });
    },
  };
}
