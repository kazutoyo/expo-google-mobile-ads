import {
  AndroidConfig,
  ConfigPlugin,
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
  withInfoPlist,
  withProjectBuildGradle,
} from 'expo/config-plugins';
import fs from 'fs';
import path from 'path';

export type Options = {
  androidAppId?: string;
  iosAppId?: string;
  delayAppMeasurementInit?: boolean;
  androidDependencies?: string[];
  androidMavenRepositories?: string[];
  iosPods?: Record<string, string>;
};

const APP_ID_PATTERN = /^ca-app-pub-\d+~\d+$/;

export function validateAppId(appId: string | undefined, platform: 'android' | 'ios'): string {
  const key = platform === 'android' ? 'androidAppId' : 'iosAppId';

  if (!appId) {
    throw new Error(
      `[expo-google-mobile-ads] ${key} が設定されていません。` +
        `app.json のプラグイン設定に AdMob の App ID を指定してください。`
    );
  }

  if (!APP_ID_PATTERN.test(appId)) {
    throw new Error(
      `[expo-google-mobile-ads] ${key} が AdMob の App ID の形式ではありません: "${appId}"。` +
        `App ID は "ca-app-pub-0000000000000000~0000000000" の形式です。` +
        `広告ユニット ID（"~" ではなく "/" 区切り）と取り違えていないか確認してください。`
    );
  }

  return appId;
}

function withAndroidDependencies(config: any, dependencies: string[]) {
  return withAppBuildGradle(config, (cfg: any) => {
    const lines = dependencies
      .filter((dep) => !cfg.modResults.contents.includes(dep))
      .map((dep) => `    implementation "${dep}"`)
      .join('\n');

    if (lines) {
      cfg.modResults.contents = cfg.modResults.contents.replace(
        /dependencies\s*\{/,
        (match: string) => `${match}\n${lines}`
      );
    }

    return cfg;
  });
}

function withIosPods(config: any, pods: Record<string, string>) {
  return withDangerousMod(config, [
    'ios',
    (cfg: any) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');

      for (const [name, version] of Object.entries(pods)) {
        const line = `  pod '${name}', '${version}'`;
        if (contents.includes(`pod '${name}'`)) continue;
        contents = contents.replace(/(\n\s*use_expo_modules!)/, `\n${line}$1`);
      }

      fs.writeFileSync(podfilePath, contents);
      return cfg;
    },
  ]);
}

const withGoogleMobileAds: ConfigPlugin<Options> = (config, options = {}) => {
  config = withAndroidManifest(config, (cfg) => {
    const appId = validateAppId(options.androidAppId, 'android');
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);

    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      application,
      'com.google.android.gms.ads.APPLICATION_ID',
      appId
    );

    if (options.delayAppMeasurementInit) {
      AndroidConfig.Manifest.addMetaDataItemToMainApplication(
        application,
        'com.google.android.gms.ads.DELAY_APP_MEASUREMENT_INIT',
        'true'
      );
    }

    return cfg;
  });

  config = withInfoPlist(config, (cfg) => {
    cfg.modResults.GADApplicationIdentifier = validateAppId(options.iosAppId, 'ios');
    if (options.delayAppMeasurementInit) {
      cfg.modResults.GADDelayAppMeasurementInit = true;
    }
    return cfg;
  });

  if (options.androidMavenRepositories?.length) {
    config = withProjectBuildGradle(config, (cfg) => {
      const repositories = options
        .androidMavenRepositories!.map((url) => `        maven { url "${url}" }`)
        .join('\n');

      cfg.modResults.contents = cfg.modResults.contents.replace(
        /allprojects\s*\{\s*repositories\s*\{/,
        (match) => `${match}\n${repositories}`
      );

      return cfg;
    });
  }

  if (options.androidDependencies?.length) {
    config = withAndroidDependencies(config, options.androidDependencies);
  }

  if (options.iosPods) {
    config = withIosPods(config, options.iosPods);
  }

  return config;
};

export default withGoogleMobileAds;
