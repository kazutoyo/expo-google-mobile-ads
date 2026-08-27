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
  // the failure still runs on the retry.
  it('runs tasks queued after a failure once a re-initialization succeeds', async () => {
    mockNative.initializeAsync.mockRejectedValueOnce(new Error('boom'));
    const beforeFailure = jest.fn();
    runWhenInitialized(beforeFailure, jest.fn());
    await expect(initialize()).rejects.toThrow('boom');
    expect(beforeFailure).not.toHaveBeenCalled();

    const afterFailure = jest.fn();
    runWhenInitialized(afterFailure, jest.fn());

    mockNative.initializeAsync.mockResolvedValueOnce(status);
    await initialize();

    expect(afterFailure).toHaveBeenCalledTimes(1);
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
