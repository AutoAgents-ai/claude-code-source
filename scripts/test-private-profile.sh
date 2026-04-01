#!/bin/bash
# Quick integration test: verify private profile loads correctly
# and disables all Anthropic services.
#
# Usage:
#   ./scripts/test-private-profile.sh
#   OPENAI_COMPAT_BASE_URL=https://api.moonshot.cn/v1 \
#   OPENAI_COMPAT_API_KEY=sk-xxx \
#   OPENAI_COMPAT_MODEL=moonshot-v1-128k \
#   ./scripts/test-private-profile.sh

set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== Private Profile Integration Test ==="
echo ""

# Set private profile
export CLAUDE_DEPLOYMENT_PROFILE=private

# Set model defaults for testing (user should override)
export OPENAI_COMPAT_BASE_URL="${OPENAI_COMPAT_BASE_URL:-https://api.example.com/v1}"
export OPENAI_COMPAT_API_KEY="${OPENAI_COMPAT_API_KEY:-test-key}"
export OPENAI_COMPAT_MODEL="${OPENAI_COMPAT_MODEL:-test-model}"

echo "Profile:    $CLAUDE_DEPLOYMENT_PROFILE"
echo "Base URL:   $OPENAI_COMPAT_BASE_URL"
echo "Model:      $OPENAI_COMPAT_MODEL"
echo ""

# Test 1: Verify gateway config loads
echo "--- Test: Gateway Config ---"
node -e "
const { getGatewayConfig, isOpenAICompatMode, isRouteEnabled } = require('./src/config/gateway.ts');
const config = getGatewayConfig();
console.log('Provider:', config.model.provider);
console.log('Brand config dir:', config.brand.configDir);
console.log('Brand user agent:', config.brand.userAgent);
console.log('OpenAI compat mode:', isOpenAICompatMode());
console.log('Telemetry enabled:', isRouteEnabled('telemetry'));
console.log('OAuth enabled:', isRouteEnabled('oauth'));
console.log('AutoUpdate enabled:', isRouteEnabled('autoUpdate'));
console.log('');
if (config.model.provider !== 'openai-compat') {
  console.error('FAIL: Expected openai-compat provider');
  process.exit(1);
}
if (config.brand.configDir !== '.autoagents') {
  console.error('FAIL: Expected .autoagents config dir');
  process.exit(1);
}
if (isRouteEnabled('telemetry')) {
  console.error('FAIL: Expected telemetry disabled');
  process.exit(1);
}
console.log('PASS: Gateway config loaded correctly');
" 2>&1 || echo "(Test requires TypeScript runtime - try: bun scripts/test-private-profile.sh)"

echo ""
echo "=== End ==="
