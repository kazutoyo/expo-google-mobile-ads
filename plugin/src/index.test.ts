import withGoogleMobileAds, {
  injectAndroidDependencies,
  injectAndroidMavenRepositories,
  injectIosPods,
  validateAppId,
} from './index';

// Only the `with*` wrappers are stubbed — they normally defer the callback until prebuild, which
// a unit test has no way to reach. `AndroidConfig` stays real, so the manifest helpers the plugin
// relies on are part of what's under test. (babel-plugin-jest-hoist lifts this above the import
// above, so `./index` still sees the mock.)
jest.mock('expo/config-plugins', () => {
  const actual = jest.requireActual('expo/config-plugins');
  return {
    ...actual,
    withAndroidManifest: (config: any, action: any) =>
      action({ ...config, modResults: config.__androidManifest }),
    withInfoPlist: (config: any, action: any) =>
      action({ ...config, modResults: config.__infoPlist }),
    withAppBuildGradle: (config: any) => config,
    withProjectBuildGradle: (config: any) => config,
    withDangerousMod: (config: any) => config,
  };
});

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

describe('delayAppMeasurementInit', () => {
  const ANDROID_KEY = 'com.google.android.gms.ads.DELAY_APP_MEASUREMENT_INIT';

  type State = { androidManifest: any; infoPlist: Record<string, any> };

  function freshState(): State {
    return {
      androidManifest: {
        manifest: { application: [{ $: { 'android:name': '.MainApplication' } }] },
      },
      infoPlist: {},
    };
  }

  /** Runs the plugin against `state`, mutating it the way a prebuild would. */
  function runPlugin(delayAppMeasurementInit: boolean | undefined, state = freshState()): State {
    withGoogleMobileAds(
      {
        __androidManifest: state.androidManifest,
        __infoPlist: state.infoPlist,
      } as any,
      {
        androidAppId: 'ca-app-pub-3940256099942544~3347511713',
        iosAppId: 'ca-app-pub-3940256099942544~1458002511',
        delayAppMeasurementInit,
      }
    );
    return state;
  }

  function metaDataValue(androidManifest: any, name: string): string | undefined {
    const items = androidManifest.manifest.application[0]['meta-data'] ?? [];
    return items.find((item: any) => item.$['android:name'] === name)?.$['android:value'];
  }

  it('adds the manifest meta-data and the plist key when enabled', () => {
    const state = runPlugin(true);

    expect(metaDataValue(state.androidManifest, ANDROID_KEY)).toBe('true');
    expect(state.infoPlist.GADDelayAppMeasurementInit).toBe(true);
  });

  // A prebuild runs against whatever is already on disk. Without the removal branch, turning the
  // option back off left both keys in place and the setting silently stayed on forever.
  it('removes both again when the option is turned back off', () => {
    const state = runPlugin(true);
    runPlugin(false, state);

    expect(metaDataValue(state.androidManifest, ANDROID_KEY)).toBeUndefined();
    expect('GADDelayAppMeasurementInit' in state.infoPlist).toBe(false);
    // The app ID must survive the removal — only the delay key goes.
    expect(metaDataValue(state.androidManifest, 'com.google.android.gms.ads.APPLICATION_ID')).toBe(
      'ca-app-pub-3940256099942544~3347511713'
    );
    expect(state.infoPlist.GADApplicationIdentifier).toBe('ca-app-pub-3940256099942544~1458002511');
  });

  it('adds neither when the option was never set', () => {
    const state = runPlugin(undefined);

    expect(metaDataValue(state.androidManifest, ANDROID_KEY)).toBeUndefined();
    expect('GADDelayAppMeasurementInit' in state.infoPlist).toBe(false);
  });
});
