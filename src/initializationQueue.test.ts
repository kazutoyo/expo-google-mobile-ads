import { createInitializationQueue } from './initializationQueue';

const noop = () => {};

describe('createInitializationQueue', () => {
  it('queues a task without running it before initialization completes', () => {
    const queue = createInitializationQueue();
    const task = jest.fn();

    queue.run(task, noop);

    expect(task).not.toHaveBeenCalled();
  });

  it('runs queued tasks in registration order on resolve', () => {
    const queue = createInitializationQueue();
    const order: number[] = [];

    queue.run(() => order.push(1), noop);
    queue.run(() => order.push(2), noop);
    queue.resolve();

    expect(order).toEqual([1, 2]);
  });

  it('runs a task immediately once already resolved', () => {
    const queue = createInitializationQueue();
    queue.resolve();
    const task = jest.fn();

    queue.run(task, noop);

    expect(task).toHaveBeenCalledTimes(1);
  });

  it('only runs a task once even if resolve is called twice', () => {
    const queue = createInitializationQueue();
    const task = jest.fn();

    queue.run(task, noop);
    queue.resolve();
    queue.resolve();

    expect(task).toHaveBeenCalledTimes(1);
  });

  it('reports the error to queued tasks on reject, without running them', () => {
    const queue = createInitializationQueue();
    const task = jest.fn();
    const onInitializationError = jest.fn();
    const error = new Error('boom');

    queue.run(task, onInitializationError);
    queue.reject(error);

    expect(task).not.toHaveBeenCalled();
    expect(onInitializationError).toHaveBeenCalledWith(error);
  });

  it('only reports a rejection once, and re-opens the queue for a retry', () => {
    const queue = createInitializationQueue();
    const onInitializationError = jest.fn();
    const task = jest.fn();

    queue.run(task, onInitializationError);
    queue.reject(new Error('boom'));
    queue.reject(new Error('boom again'));

    expect(onInitializationError).toHaveBeenCalledTimes(1);

    // markInitializeCalled() is what re-opens the queue, so a task arriving during the retry
    // waits for its result instead of being failed by the previous attempt's error.
    queue.markInitializeCalled();
    const retried = jest.fn();
    queue.run(retried, noop);
    expect(retried).not.toHaveBeenCalled();

    queue.resolve();

    expect(retried).toHaveBeenCalledTimes(1);
    // The task that was already reported as failed must not be run by the later success.
    expect(task).not.toHaveBeenCalled();
  });

  // Without this the ad sits on `loading` forever: nothing drains the queue after a failure, and
  // isInitializeCalled() is true so there is no dev warning either.
  it('fails a task that arrives after a rejection immediately', () => {
    const queue = createInitializationQueue();
    const error = new Error('boom');
    queue.reject(error);

    const task = jest.fn();
    const onInitializationError = jest.fn();
    queue.run(task, onInitializationError);

    expect(task).not.toHaveBeenCalled();
    expect(onInitializationError).toHaveBeenCalledWith(error);
  });

  it('ignores a rejection that arrives after resolve', () => {
    const queue = createInitializationQueue();
    const onInitializationError = jest.fn();

    queue.run(jest.fn(), onInitializationError);
    queue.resolve();
    queue.reject(new Error('boom'));

    expect(onInitializationError).not.toHaveBeenCalled();
  });

  it('tracks whether initialize has been called', () => {
    const queue = createInitializationQueue();

    expect(queue.isInitializeCalled()).toBe(false);
    queue.markInitializeCalled();
    expect(queue.isInitializeCalled()).toBe(true);
  });
});
