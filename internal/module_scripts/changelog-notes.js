#!/usr/bin/env node
// Prints the CHANGELOG.md section for a version, exiting non-zero if it has
// none. The release workflow runs this twice: once before publishing, because a
// version can never be republished and a missing entry has to stop the run
// while the number is still free, and once after, to write the GitHub release
// notes. Kept out of the workflow so the two calls cannot drift.
const fs = require('fs');

const version = process.argv[2];
if (!version) {
  console.error('usage: changelog-notes.js <version>');
  process.exit(1);
}

const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const section = new RegExp(`^## \\[${escaped}\\].*$([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'm').exec(
  fs.readFileSync('CHANGELOG.md', 'utf8')
);

if (!section || !section[1].trim()) {
  console.error(`CHANGELOG.md has no entry for ${version}`);
  process.exit(1);
}

console.log(section[1].trim());
