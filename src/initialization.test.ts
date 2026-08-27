jest.mock('./ExpoGoogleMobileAdsModule', () => ({
  __esModule: true,
  default: {
    initializeAsync: jest.fn(),
    setRequestConfiguration: jest.fn(),
  },
}));

import NativeModule from './ExpoGoogleMobileAdsModule';
import { initialize, runWhenInitialized, setRequestConfiguration, __resetForTesting } from './initialization';

const mockNative = NativeModule as jest.Mocked<typeof NativeModule>;
const status = { adapterStatuses: {} };

beforeEach(() => {
  __resetForTesting();
  jest.clearAllMocks();
  mockNative.initializeAsync.mockResolvedValue(status);
});

describe('initialize', () => {
  it('calls native initialization and returns the result', async () => {
    await expect(initialize()).resolves.toBe(status);
    expect(mockNative.initializeAsync).toHaveBeenCalledTimes(1);
  });

  it('only initializes native once even when called twice', async () => {
    await Promise.all([initialize(), initialize()]);
    expect(mockNative.initializeAsync).toHaveBeenCalledTimes(1);
  });

  it('runs pending tasks once initialization completes', async () => {
    const task = jest.fn();
    runWhenInitialized(task, jest.fn());
    expect(task).not.toHaveBeenCalled();

    await initialize();

    expect(task).toHaveBeenCalledTimes(1);
  });

  // Deliberate: nothing may load against an SDK that failed to initialize. But the failure has
  // to reach the pending task's owner, or the ad it belongs to stays `loading` forever.
  it('does not run pending tasks if initialization fails, but reports the error to them', async () => {
    const error = new Error('boom');
    mockNative.initializeAsync.mockRejectedValue(error);
    const task = jest.fn();
    const onInitializationError = jest.fn();
    runWhenInitialized(task, onInitializationError);

    await expect(initialize()).rejects.toThrow('boom');

    expect(task).not.toHaveBeenCalled();
    expect(onInitializationError).toHaveBeenCalledWith(error);
  });

  it('re-runs native initialization when called again after a failure', async () => {
    mockNative.initializeAsync.mockRejectedValueOnce(new Error('boom'));
    await expect(initialize()).rejects.toThrow('boom');

    mockNative.initializeAsync.mockResolvedValueOnce(status);
    await expect(initialize()).resolves.toBe(status);

    expect(mockNative.initializeAsync).toHaveBeenCalledTimes(2);
  });

  // A task queued *before* the failure has already been told the SDK failed, so it isn't run
  // again by a later success — it's the ad's owner's call whether to retry. A task queued after
  // the failure is failed immediately rather than waiting for a retry that may never come.
  // An ad created *after* a failed initialize() used to be pushed onto a queue nothing would
  // ever drain: it got no load, no error, and no dev warning (isInitializeCalled() is true), so
  // it sat on `loading` forever — the exact state reject() exists to prevent for the ads queued
  // before the failure.
  it('reports the failure immediately to a task queued after it', async () => {
    const failure = new Error('boom');
    mockNative.initializeAsync.mockRejectedValueOnce(failure);
    await expect(initialize()).rejects.toThrow('boom');

    const afterFailure = jest.fn();
    const onInitializationError = jest.fn();
    runWhenInitialized(afterFailure, onInitializationError);

    expect(afterFailure).not.toHaveBeenCalled();
    expect(onInitializationError).toHaveBeenCalledWith(failure);
  });

  it('runs tasks queued during a re-initialization once it succeeds', async () => {
    mockNative.initializeAsync.mockRejectedValueOnce(new Error('boom'));
    const beforeFailure = jest.fn();
    runWhenInitialized(beforeFailure, jest.fn());
    await expect(initialize()).rejects.toThrow('boom');
    expect(beforeFailure).not.toHaveBeenCalled();

    // The retry re-opens the queue, so this one waits for its result rather than being failed
    // by the previous attempt's error.
    mockNative.initializeAsync.mockResolvedValueOnce(status);
    const retry = initialize();
    const duringRetry = jest.fn();
    const onInitializationError = jest.fn();
    runWhenInitialized(duringRetry, onInitializationError);
    expect(duringRetry).not.toHaveBeenCalled();
    expect(onInitializationError).not.toHaveBeenCalled();

    await retry;

    expect(duringRetry).toHaveBeenCalledTimes(1);
    // The task that was already reported as failed must not be run by the later success.
    expect(beforeFailure).not.toHaveBeenCalled();
  });
});

describe('runWhenInitialized', () => {
  it('warns in __DEV__ when initialize has not been called', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    runWhenInitialized(jest.fn(), jest.fn());

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('initialize()'));
    warn.mockRestore();
  });

  it('does not warn once initialize has been called', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    initialize();
    runWhenInitialized(jest.fn(), jest.fn());

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('setRequestConfiguration', () => {
  it('passes the config through to native unchanged', () => {
    const config = { testDeviceIds: ['ABC'] };
    setRequestConfiguration(config);
    expect(mockNative.setRequestConfiguration).toHaveBeenCalledWith(config);
  });
});
