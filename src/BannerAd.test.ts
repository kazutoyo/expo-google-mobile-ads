jest.mock('./ExpoGoogleMobileAdsModule', () => ({
  __esModule: true,
  default: { BannerAd: jest.fn() },
}));

jest.mock('./initialization', () => ({
  runWhenInitialized: jest.fn(),
}));

import NativeModule from './ExpoGoogleMobileAdsModule';
import { runWhenInitialized } from './initialization';
import { createBannerAd } from './BannerAd';

// babel-jest hoists the `import` requires above a plain top-level `const`,
// so a jest.fn() declared before jest.mock() would be captured as `undefined`
// inside the factory. Define the mock inline in the factory instead, and
// grab the reference afterwards (same pattern as BannerAdSize.test.ts).
const mockNativeBannerAd = NativeModule.BannerAd as jest.Mock;
const mockRunWhenInitialized = runWhenInitialized as jest.Mock;
const size = { width: 360, height: 50 };

beforeEach(() => {
  jest.clearAllMocks();
  mockNativeBannerAd.mockImplementation(function (this: any) {
    this.load = jest.fn();
  });
});

describe('createBannerAd', () => {
  it('ネイティブの BannerAd を生成して返す', () => {
    const ad = createBannerAd({ adUnitId: 'unit', size });

    expect(mockNativeBannerAd).toHaveBeenCalledWith('unit', size, undefined);
    expect(ad).toBeInstanceOf(mockNativeBannerAd);
  });

  it('requestOptions をネイティブへ渡す', () => {
    const requestOptions = { keywords: ['game'] };

    createBannerAd({ adUnitId: 'unit', size, requestOptions });

    expect(mockNativeBannerAd).toHaveBeenCalledWith('unit', size, requestOptions);
  });

  it('ロードを直接呼ばず、初期化完了まで保留する', () => {
    const ad = createBannerAd({ adUnitId: 'unit', size });

    expect((ad as any).load).not.toHaveBeenCalled();
    expect(mockRunWhenInitialized).toHaveBeenCalledTimes(1);
  });

  it('保留されたタスクを実行するとロードが始まる', () => {
    const ad = createBannerAd({ adUnitId: 'unit', size });

    mockRunWhenInitialized.mock.calls[0][0]();

    expect((ad as any).load).toHaveBeenCalledTimes(1);
  });
});
