#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
expiry_test_dir=$(mktemp -d)
trap 'rm -rf "$expiry_test_dir"' EXIT
xcrun --sdk macosx swiftc -module-cache-path "$expiry_test_dir/module-cache" ios/AppOpenAdExpiry.swift tests/ios/main.swift -o "$expiry_test_dir/tests"
"$expiry_test_dir/tests"
