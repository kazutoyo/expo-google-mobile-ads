// Expo config plugin entry point.
// @expo/config-plugins resolves a package's plugin by looking for
// "<package>/app.plugin.{js,cjs,mjs,ts,cts,mts}" at the package root
// (see @expo/config-plugins/build/utils/plugin-resolver.js, resolvePluginForModule,
// step 2) — the package.json "appPlugin" field is not read by current
// @expo/config-plugins and has no effect.
module.exports = require('./plugin/build');
