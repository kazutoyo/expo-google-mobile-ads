const mockNativeView = jest.fn((_props: any) => null);

// requireNativeViewManager() は BannerAdView.tsx のモジュール評価時（import 巻き上げにより
// このファイルの mockNativeView 代入より前）に一度だけ呼ばれるため、戻り値を直接
// mockNativeView にすると巻き上げ順の問題で undefined を返してしまう。
// 呼び出しを遅延させるラッパーを返し、実際の描画時に mockNativeView を参照する。
jest.mock('expo-modules-core', () => ({
  requireNativeViewManager: () => (props: any) => mockNativeView(props),
}));

import { render } from '@testing-library/react-native';

import { BannerAdView } from './BannerAdView';

const size = { width: 360, height: 50 };

function makeAd(overrides: any = {}) {
  return { status: 'loading', ...overrides } as any;
}

beforeEach(() => jest.clearAllMocks());

describe('BannerAdView', () => {
  it('ad をネイティブ View へ渡す', async () => {
    const ad = makeAd();

    await render(<BannerAdView ad={ad} />);

    expect(mockNativeView.mock.calls[0][0]).toMatchObject({ ad });
  });

  it('ロード前はリクエストしたサイズで領域を予約する', async () => {
    const ad = makeAd({ size });

    await render(<BannerAdView ad={ad} />);

    expect(mockNativeView.mock.calls[0][0].style).toEqual(
      expect.arrayContaining([{ width: 360, height: 50 }])
    );
  });

  it('ロード後は実際に返ったサイズを使う', async () => {
    const ad = makeAd({ status: 'loaded', size, loadedSize: { width: 390, height: 100 } });

    await render(<BannerAdView ad={ad} />);

    expect(mockNativeView.mock.calls[0][0].style).toEqual(
      expect.arrayContaining([{ width: 390, height: 100 }])
    );
  });

  it('style で上書きできる', async () => {
    const ad = makeAd({ size });

    await render(<BannerAdView ad={ad} style={{ height: 200 }} />);

    const style = mockNativeView.mock.calls[0][0].style;
    expect(style[style.length - 1]).toEqual({ height: 200 });
  });
});
