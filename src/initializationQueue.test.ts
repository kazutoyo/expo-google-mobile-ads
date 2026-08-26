import { createInitializationQueue } from './initializationQueue';

describe('createInitializationQueue', () => {
  it('初期化未完了のタスクは実行されずキューに積まれる', () => {
    const queue = createInitializationQueue();
    const task = jest.fn();

    queue.run(task);

    expect(task).not.toHaveBeenCalled();
  });

  it('resolve でキュー内のタスクが登録順に実行される', () => {
    const queue = createInitializationQueue();
    const order: number[] = [];

    queue.run(() => order.push(1));
    queue.run(() => order.push(2));
    queue.resolve();

    expect(order).toEqual([1, 2]);
  });

  it('resolve 後のタスクは即座に実行される', () => {
    const queue = createInitializationQueue();
    queue.resolve();
    const task = jest.fn();

    queue.run(task);

    expect(task).toHaveBeenCalledTimes(1);
  });

  it('resolve を二度呼んでもタスクは一度しか実行されない', () => {
    const queue = createInitializationQueue();
    const task = jest.fn();

    queue.run(task);
    queue.resolve();
    queue.resolve();

    expect(task).toHaveBeenCalledTimes(1);
  });

  it('initialize が呼ばれたかを記録できる', () => {
    const queue = createInitializationQueue();

    expect(queue.isInitializeCalled()).toBe(false);
    queue.markInitializeCalled();
    expect(queue.isInitializeCalled()).toBe(true);
  });
});
