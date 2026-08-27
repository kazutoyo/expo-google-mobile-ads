import { createInitializationQueue } from './initializationQueue';

describe('createInitializationQueue', () => {
  it('queues a task without running it before initialization completes', () => {
    const queue = createInitializationQueue();
    const task = jest.fn();

    queue.run(task);

    expect(task).not.toHaveBeenCalled();
  });

  it('runs queued tasks in registration order on resolve', () => {
    const queue = createInitializationQueue();
    const order: number[] = [];

    queue.run(() => order.push(1));
    queue.run(() => order.push(2));
    queue.resolve();

    expect(order).toEqual([1, 2]);
  });

  it('runs a task immediately once already resolved', () => {
    const queue = createInitializationQueue();
    queue.resolve();
    const task = jest.fn();

    queue.run(task);

    expect(task).toHaveBeenCalledTimes(1);
  });

  it('only runs a task once even if resolve is called twice', () => {
    const queue = createInitializationQueue();
    const task = jest.fn();

    queue.run(task);
    queue.resolve();
    queue.resolve();

    expect(task).toHaveBeenCalledTimes(1);
  });

  it('tracks whether initialize has been called', () => {
    const queue = createInitializationQueue();

    expect(queue.isInitializeCalled()).toBe(false);
    queue.markInitializeCalled();
    expect(queue.isInitializeCalled()).toBe(true);
  });
});
