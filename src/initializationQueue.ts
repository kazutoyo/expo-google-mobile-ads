/** A task waiting for the SDK to finish initializing, plus how to report a failed one. */
type PendingTask = {
  task: () => void;
  /** Called instead of `task` when initialization fails. */
  onInitializationError: (error: unknown) => void;
};

export type InitializationQueue = {
  /**
   * Records that `initialize()` was called, and clears any remembered failure: a fresh attempt
   * re-opens the queue, so tasks arriving during the retry wait for its result instead of being
   * failed immediately by the previous attempt's error.
   */
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
  /**
   * The error from the last failed initialization, boxed so that `null` means "no failure"
   * without assuming anything about what was thrown. Cleared by `markInitializeCalled()`.
   *
   * Without this, a task arriving *after* the failure would just be pushed onto a queue nothing
   * will ever drain: `isInitializeCalled()` is still true, so it gets no dev warning either, and
   * the ad it belongs to sits on `loading` forever with no error anywhere — exactly the state
   * `reject()` exists to prevent for the tasks queued before the failure.
   */
  let failure: { error: unknown } | null = null;

  return {
    markInitializeCalled() {
      initializeCalled = true;
      failure = null;
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
      failure = { error };
      const tasks = pending;
      pending = [];
      tasks.forEach(({ onInitializationError }) => onInitializationError(error));
    },
    run(task, onInitializationError) {
      if (resolved) {
        task();
        return;
      }
      if (failure) {
        onInitializationError(failure.error);
        return;
      }
      pending.push({ task, onInitializationError });
    },
  };
}
