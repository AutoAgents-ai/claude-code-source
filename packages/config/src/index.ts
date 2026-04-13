// ============================================================
// @anthropic-ai/cc-config — Deployment profiles, model configs, env helpers
//
// LAYER: Foundation (zero external deps, pure data + env reads)
//
// CONSTRAINTS:
// - No imports from the main app (src/)
// - No side effects at import time (lazy singleton via getGatewayConfig)
// - All env reads explicit and documented
// ============================================================

export * from './env.js'
export * from './gateway.js'
export * from './models.js'
export * from './providers.js'
