// Dev-mode polyfills for Bun bundler compile-time macros.
// Loaded via bunfig.toml preload so `bun run src/entrypoints/cli.tsx` works
// without a build step.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf-8'))

// MACRO.* — build-time constants that bun build --define would inline
;(globalThis as any).MACRO = {
  VERSION: pkg.version,
  PACKAGE_URL: '@anthropic-ai/claude-code',
  NATIVE_PACKAGE_URL: undefined,
  BUILD_TIME: new Date().toISOString(),
  VERSION_CHANGELOG: '',
  FEEDBACK_CHANNEL: 'https://github.com/anthropics/claude-code/issues',
  ISSUES_EXPLAINER: 'report issues at https://github.com/anthropics/claude-code/issues',
}

// feature() — build-time DCE gates. In dev mode all external-safe features
// return true; internal-only features return false.
const INTERNAL_ONLY = new Set([
  'ABLATION_BASELINE',
  'ANTI_DISTILLATION_CC',
  'BYOC_ENVIRONMENT_RUNNER',
  'SELF_HOSTED_RUNNER',
  'CHICAGO_MCP',
  'DUMP_SYSTEM_PROMPT',
  'NATIVE_CLIENT_ATTESTATION',
  'CCR_AUTO_CONNECT',
  'CCR_MIRROR',
  'CCR_REMOTE_SETUP',
  'DIRECT_CONNECT',
  'ENHANCED_TELEMETRY_BETA',
  'KAIROS',
  'KAIROS_BRIEF',
  'KAIROS_CHANNELS',
  'KAIROS_DREAM',
  'KAIROS_GITHUB_WEBHOOKS',
  'KAIROS_PUSH_NOTIFICATION',
  'LODESTONE',
  'OVERFLOW_TEST_TOOL',
  'TORCH',
])

;(globalThis as any).feature = (name: string): boolean => {
  return !INTERNAL_ONLY.has(name)
}
