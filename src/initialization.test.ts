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
    runWhenInitialized(task);
    expect(task).not.toHaveBeenCalled();

    await initialize();

    expect(task).toHaveBeenCalledTimes(1);
  });

  it('does not run pending tasks if initialization fails', async () => {
    mockNative.initializeAsync.mockRejectedValue(new Error('boom'));
    const task = jest.fn();
    runWhenInitialized(task);

    await expect(initialize()).rejects.toThrow('boom');

    expect(task).not.toHaveBeenCalled();
  });

  it('re-runs native initialization when called again after a failure', async () => {
    mockNative.initializeAsync.mockRejectedValueOnce(new Error('boom'));
    await expect(initialize()).rejects.toThrow('boom');

    mockNative.initializeAsync.mockResolvedValueOnce(status);
    await expect(initialize()).resolves.toBe(status);

    expect(mockNative.initializeAsync).toHaveBeenCalledTimes(2);
  });

  it('runs pending tasks once a re-initialization after a failure succeeds', async () => {
    mockNative.initializeAsync.mockRejectedValueOnce(new Error('boom'));
    const task = jest.fn();
    runWhenInitialized(task);
    await expect(initialize()).rejects.toThrow('boom');
    expect(task).not.toHaveBeenCalled();

    mockNative.initializeAsync.mockResolvedValueOnce(status);
    await initialize();

    expect(task).toHaveBeenCalledTimes(1);
  });
});

describe('runWhenInitialized', () => {
  it('warns in __DEV__ when initialize has not been called', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    runWhenInitialized(jest.fn());

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('initialize()'));
    warn.mockRestore();
  });

  it('does not warn once initialize has been called', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    initialize();
    runWhenInitialized(jest.fn());

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
