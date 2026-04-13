// ============================================================
// @anthropic-ai/cc-core — Agent loop and orchestration
//
// LAYER: Core (depends only on cc-types)
//
// CONSTRAINTS:
// - Zero direct I/O — all I/O through Ports
// - No dependency on Anthropic SDK, React, or any Host
// - Host creates Ports, Core consumes them
// ============================================================

export * from './host.js'
export * from './query-config.js'
