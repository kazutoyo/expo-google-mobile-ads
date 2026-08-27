import {
  injectAndroidDependencies,
  injectAndroidMavenRepositories,
  injectIosPods,
  validateAppId,
} from './index';

describe('validateAppId', () => {
  it('accepts the correct format', () => {
    expect(() =>
      validateAppId('ca-app-pub-3940256099942544~3347511713', 'android')
    ).not.toThrow();
  });

  it('errors when unset', () => {
    expect(() => validateAppId(undefined, 'android')).toThrow(/androidAppId/);
  });

  it('errors when an ad unit ID is passed by mistake', () => {
    // An ad unit ID is separated by / rather than ~
    expect(() =>
      validateAppId('ca-app-pub-3940256099942544/9214589741', 'ios')
    ).toThrow(/App ID/);
  });

  it('errors on a garbage string', () => {
    expect(() => validateAppId('not-an-app-id', 'ios')).toThrow(/App ID/);
  });
});

describe('injectAndroidMavenRepositories', () => {
  const gradle = 'allprojects {\n    repositories {\n        google()\n    }\n}\n';

  it('is appended the first time', () => {
    const result = injectAndroidMavenRepositories(gradle, ['https://example.com/repo']);
    expect(result).toContain('maven { url "https://example.com/repo" }');
  });

  it('is not appended twice the second time', () => {
    const once = injectAndroidMavenRepositories(gradle, ['https://example.com/repo']);
    const twice = injectAndroidMavenRepositories(once, ['https://example.com/repo']);
    expect(twice.match(/https:\/\/example\.com\/repo/g)).toHaveLength(1);
  });
});

describe('injectAndroidDependencies', () => {
  const gradle = 'dependencies {\n    implementation "com.example:existing:1.0.0"\n}\n';

  it('is appended the first time', () => {
    const result = injectAndroidDependencies(gradle, ['com.google.android.gms:play-services-ads:23.0.0']);
    expect(result).toContain('implementation "com.google.android.gms:play-services-ads:23.0.0"');
  });

  it('is not appended twice the second time', () => {
    const dep = 'com.google.android.gms:play-services-ads:23.0.0';
    const once = injectAndroidDependencies(gradle, [dep]);
    const twice = injectAndroidDependencies(once, [dep]);
    expect(twice.match(/play-services-ads:23\.0\.0/g)).toHaveLength(1);
  });
});

describe('injectIosPods', () => {
  const podfile = "target 'App' do\n  use_expo_modules!\nend\n";

  it('is appended the first time', () => {
    const result = injectIosPods(podfile, { 'Google-Mobile-Ads-SDK': '11.0.0' });
    expect(result).toContain("pod 'Google-Mobile-Ads-SDK', '11.0.0'");
  });

  it('is not appended twice the second time', () => {
    const pods = { 'Google-Mobile-Ads-SDK': '11.0.0' };
    const once = injectIosPods(podfile, pods);
    const twice = injectIosPods(once, pods);
    expect(twice.match(/Google-Mobile-Ads-SDK/g)).toHaveLength(1);
  });
});
