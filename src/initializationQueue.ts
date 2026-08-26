export type InitializationQueue = {
  markInitializeCalled(): void;
  isInitializeCalled(): boolean;
  resolve(): void;
  run(task: () => void): void;
};

export function createInitializationQueue(): InitializationQueue {
  let initializeCalled = false;
  let resolved = false;
  let pending: (() => void)[] = [];

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
      tasks.forEach((task) => task());
    },
    run(task) {
      if (resolved) {
        task();
        return;
      }
      pending.push(task);
    },
  };
}
