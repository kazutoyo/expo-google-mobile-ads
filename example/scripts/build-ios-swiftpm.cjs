#!/usr/bin/env node
// Build only: no simulator is selected, booted, or installed onto.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');

const appRoot = fs.realpathSync(process.cwd());
const appRequire = createRequire(path.join(appRoot, 'package.json'));
const iosRoot = path.join(appRoot, 'ios');
const projects = fs.existsSync(iosRoot)
  ? fs.readdirSync(iosRoot).filter((name) => name.endsWith('.xcodeproj'))
  : [];
if (projects.length !== 1) {
  throw new Error(
    'Generate the example iOS project with Expo prebuild before running this script.'
  );
}

// Expo 58.0.26 makes the host macro a transitive library dependency. Xcode
// compiles it for iOS, where its macOS SwiftSyntax prebuilts cannot be loaded.
// For this sample, use the same shipped macro executable as CocoaPods builds.
// Patch the generator so build-time autolinking sync preserves the workaround.
const expoRoot = path.dirname(appRequire.resolve('expo/package.json'));
const macroRoot = path.dirname(appRequire.resolve('expo-modules-macros/package.json'));
const expoVersion = appRequire('expo/package.json').version;
const macroVersion = appRequire('expo-modules-macros/package.json').version;
if (expoVersion !== '58.0.26' || macroVersion !== '0.33.0') {
  throw new Error(
    `Recheck the SwiftPM macro workaround for Expo ${expoVersion} / macros ${macroVersion}.`
  );
}
const generator = path.join(expoRoot, 'scripts/spm/direct.js');
const original =
  '                .product(name: "${MACROS_PRODUCT}", package: "${MACROS_PACKAGE}"),';
const replacement =
  '                // The sample loads the shipped Expo macro executable via OTHER_SWIFT_FLAGS.';
const contents = fs.readFileSync(generator, 'utf8');
if (contents.includes(original)) {
  if (contents.split(original).length !== 2) throw new Error('Unexpected Expo SwiftPM generator.');
  fs.writeFileSync(generator, contents.replace(original, replacement));
} else if (!contents.includes(replacement)) {
  throw new Error('Expo SwiftPM generator changed; recheck the macro workaround.');
}
const macroBinary = path.join(macroRoot, 'apple/ExpoModulesMacros');
fs.accessSync(macroBinary, fs.constants.X_OK);

function run(command, args) {
  const result = spawnSync(command, args, { cwd: appRoot, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const project = projects[0];
const injected = fs.existsSync(path.join(iosRoot, project, '.spm-injected.json'));
run(process.execPath, [
  path.join(
    path.dirname(appRequire.resolve('react-native/package.json')),
    'scripts/setup-apple-spm.js'
  ),
  ...(injected ? ['update'] : ['add', '--deintegrate', '--yes']),
  '--config-command',
  JSON.stringify([
    process.execPath,
    path.join(
      path.dirname(appRequire.resolve('expo-modules-autolinking/package.json')),
      'bin/expo-modules-autolinking.js'
    ),
    'react-native-config',
    '--json',
    '--platform',
    'ios',
  ]),
]);

// `pod deintegrate` leaves Expo's provider and configure phase behind. SwiftPM
// already generates its own provider; remove only the references into Pods.
const xcode = appRequire('xcode');
const projectFile = path.join(iosRoot, project, 'project.pbxproj');
const nativeProject = xcode.project(projectFile);
nativeProject.parseSync();
const objects = nativeProject.hash.project.objects;
const obsolete = new Set();
for (const [id, phase] of Object.entries(objects.PBXShellScriptBuildPhase ?? {})) {
  if (
    typeof phase === 'object' &&
    phase.shellScript?.includes('expo-configure-project.sh') &&
    phase.shellScript.includes('Pods')
  ) {
    obsolete.add(id);
  }
}
for (const [id, file] of Object.entries(objects.PBXFileReference ?? {})) {
  if (
    typeof file === 'object' &&
    /Pods\/Target Support Files\/.*\/ExpoModulesProvider\.swift/.test(file.path ?? '')
  ) {
    obsolete.add(id);
  }
}
for (const [id, file] of Object.entries(objects.PBXBuildFile ?? {})) {
  if (typeof file === 'object' && obsolete.has(file.fileRef)) obsolete.add(id);
}
for (const section of Object.values(objects)) {
  for (const [id, object] of Object.entries(section)) {
    if (obsolete.has(id)) {
      delete section[id];
      delete section[`${id}_comment`];
    } else if (typeof object === 'object') {
      for (const [key, value] of Object.entries(object)) {
        if (Array.isArray(value)) object[key] = value.filter((ref) => !obsolete.has(ref.value));
      }
    }
  }
}
fs.writeFileSync(projectFile, nativeProject.writeSync());

run('xcodebuild', [
  '-project',
  path.join(iosRoot, project),
  '-scheme',
  project.slice(0, -'.xcodeproj'.length),
  '-configuration',
  'Debug',
  '-sdk',
  'iphonesimulator',
  '-destination',
  'generic/platform=iOS Simulator',
  '-derivedDataPath',
  process.env.SWIFTPM_DERIVED_DATA ?? path.join(iosRoot, 'build/swiftpm-derived'),
  'CODE_SIGNING_ALLOWED=NO',
  `OTHER_SWIFT_FLAGS=$(inherited) -load-plugin-executable "${macroBinary}#ExpoModulesMacros"`,
  'build',
]);
