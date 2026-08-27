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
      `[expo-google-mobile-ads] ${key} is not set. ` +
        `Specify your AdMob App ID in the plugin config in app.json.`
    );
  }

  if (!APP_ID_PATTERN.test(appId)) {
    throw new Error(
      `[expo-google-mobile-ads] ${key} is not in the AdMob App ID format: "${appId}". ` +
        `An App ID looks like "ca-app-pub-0000000000000000~0000000000". ` +
        `Check that you haven't passed an ad unit ID by mistake (that's separated by "/", not "~").`
    );
  }

  return appId;
}

/** Appends only the missing implementation lines to dependencies { }. Skips lines already present. */
export function injectAndroidDependencies(contents: string, dependencies: string[]): string {
  const lines = dependencies
    .filter((dep) => !contents.includes(dep))
    .map((dep) => `    implementation "${dep}"`)
    .join('\n');

  if (!lines) return contents;

  return contents.replace(/dependencies\s*\{/, (match) => `${match}\n${lines}`);
}

/** Appends only the missing maven repositories to allprojects { repositories { } }. Skips URLs already present. */
export function injectAndroidMavenRepositories(contents: string, repositories: string[]): string {
  const lines = repositories
    .filter((url) => !contents.includes(url))
    .map((url) => `        maven { url "${url}" }`)
    .join('\n');

  if (!lines) return contents;

  return contents.replace(/allprojects\s*\{\s*repositories\s*\{/, (match) => `${match}\n${lines}`);
}

/** Appends only the missing pod lines to the Podfile. Skips a pod already present under the same name. */
export function injectIosPods(contents: string, pods: Record<string, string>): string {
  let result = contents;

  for (const [name, version] of Object.entries(pods)) {
    if (result.includes(`pod '${name}'`)) continue;
    const line = `  pod '${name}', '${version}'`;
    result = result.replace(/(\n\s*use_expo_modules!)/, `\n${line}$1`);
  }

  return result;
}

function withAndroidDependencies(config: any, dependencies: string[]) {
  return withAppBuildGradle(config, (cfg: any) => {
    cfg.modResults.contents = injectAndroidDependencies(cfg.modResults.contents, dependencies);
    return cfg;
  });
}

function withIosPods(config: any, pods: Record<string, string>) {
  return withDangerousMod(config, [
    'ios',
    (cfg: any) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      const contents = fs.readFileSync(podfilePath, 'utf8');
      fs.writeFileSync(podfilePath, injectIosPods(contents, pods));
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
      cfg.modResults.contents = injectAndroidMavenRepositories(
        cfg.modResults.contents,
        options.androidMavenRepositories!
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
