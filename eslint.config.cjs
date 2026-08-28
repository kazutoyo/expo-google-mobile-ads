const { defineConfig } = require('eslint/config');
const universe = require('eslint-config-universe/flat/native');
const universeNode = require('eslint-config-universe/flat/node');
const universeWeb = require('eslint-config-universe/flat/web');

module.exports = defineConfig([
  { ignores: ['build'] },
  ...universe,
  ...universeWeb,
  // Build-tooling config files are CommonJS running under Node, not React Native modules —
  // without this they report `__dirname`, `require` and `module` as undefined globals.
  { files: ['**/*.cjs', '**/*.config.js', 'internal/**/*.js'], extends: [universeNode] },
]);
