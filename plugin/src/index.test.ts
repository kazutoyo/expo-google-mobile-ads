import { validateAppId } from './index';

describe('validateAppId', () => {
  it('正しい形式を受け入れる', () => {
    expect(() =>
      validateAppId('ca-app-pub-3940256099942544~3347511713', 'android')
    ).not.toThrow();
  });

  it('未設定ならエラー', () => {
    expect(() => validateAppId(undefined, 'android')).toThrow(/androidAppId/);
  });

  it('広告ユニット ID を間違えて渡したらエラー', () => {
    // 広告ユニット ID は ~ ではなく / で区切られる
    expect(() =>
      validateAppId('ca-app-pub-3940256099942544/9214589741', 'ios')
    ).toThrow(/App ID/);
  });

  it('でたらめな文字列はエラー', () => {
    expect(() => validateAppId('not-an-app-id', 'ios')).toThrow(/App ID/);
  });
});
