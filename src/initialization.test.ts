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
  it('ネイティブの初期化を呼び、結果を返す', async () => {
    await expect(initialize()).resolves.toBe(status);
    expect(mockNative.initializeAsync).toHaveBeenCalledTimes(1);
  });

  it('二度呼んでもネイティブの初期化は一度だけ', async () => {
    await Promise.all([initialize(), initialize()]);
    expect(mockNative.initializeAsync).toHaveBeenCalledTimes(1);
  });

  it('初期化完了で保留中のタスクが実行される', async () => {
    const task = jest.fn();
    runWhenInitialized(task);
    expect(task).not.toHaveBeenCalled();

    await initialize();

    expect(task).toHaveBeenCalledTimes(1);
  });

  it('初期化が失敗しても保留中のタスクは実行されない', async () => {
    mockNative.initializeAsync.mockRejectedValue(new Error('boom'));
    const task = jest.fn();
    runWhenInitialized(task);

    await expect(initialize()).rejects.toThrow('boom');

    expect(task).not.toHaveBeenCalled();
  });

  it('初期化が失敗した後、再度呼び出すとネイティブの初期化が再実行される', async () => {
    mockNative.initializeAsync.mockRejectedValueOnce(new Error('boom'));
    await expect(initialize()).rejects.toThrow('boom');

    mockNative.initializeAsync.mockResolvedValueOnce(status);
    await expect(initialize()).resolves.toBe(status);

    expect(mockNative.initializeAsync).toHaveBeenCalledTimes(2);
  });

  it('失敗後の再初期化が成功すると保留中のタスクが実行される', async () => {
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
  it('initialize 未呼び出しなら __DEV__ で警告する', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    runWhenInitialized(jest.fn());

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('initialize()'));
    warn.mockRestore();
  });

  it('initialize 呼び出し済みなら警告しない', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    initialize();
    runWhenInitialized(jest.fn());

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('setRequestConfiguration', () => {
  it('ネイティブへそのまま渡す', () => {
    const config = { testDeviceIds: ['ABC'] };
    setRequestConfiguration(config);
    expect(mockNative.setRequestConfiguration).toHaveBeenCalledWith(config);
  });
});
