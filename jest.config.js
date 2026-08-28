// `npm test` runs with `--forceExit` (see package.json). Without it the process exits 1 even
// when every suite passes: jest-expo's ExpoModulesCoreJSLogger setup logs
// "An error occurred while requiring the 'ExpoModulesCoreJSLogger' module" asynchronously,
// after the test run has finished, and Jest treats that stray post-teardown console call as a
// failure. Confirmed via `npx jest --detectOpenHandles`: it reports zero open handles, so this
// is not a real leak in our code — it's upstream jest-expo/expo-modules-core noise.
// If a real hang/leak is ever introduced, --forceExit will mask it (the process will exit even
// though something never finished cleaning up). Re-run without --forceExit and with
// --detectOpenHandles if `npm test` starts hanging or timing out.
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/src/**/*.test.ts', '**/src/**/*.test.tsx'],
};
