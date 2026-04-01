#!/bin/bash
# Build cli.js from source using Bun bundler
#
# Prerequisites:
#   bun install   (install dependencies)
#
# Usage:
#   ./scripts/build.sh              # build with default version
#   VERSION=1.0.0 ./scripts/build.sh  # build with custom version

set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="${VERSION:-$(node -p "require('./package.json').version")}"
PACKAGE_URL="${PACKAGE_URL:-@anthropic-ai/claude-code}"

echo "Building cli.js (v${VERSION})..."

bun build src/entrypoints/cli.tsx \
  --outfile cli.js.tmp \
  --target node \
  --tsconfig-override tsconfig.json \
  --define "MACRO.VERSION='${VERSION}'" \
  --define "MACRO.PACKAGE_URL='${PACKAGE_URL}'" \
  --define "process.env.USER_TYPE='external'"

# Prepend shebang for CLI execution
printf '#!/usr/bin/env node\n' > cli.js
cat cli.js.tmp >> cli.js
rm cli.js.tmp
chmod +x cli.js

echo "Build complete: cli.js ($(wc -c < cli.js | tr -d ' ') bytes)"
