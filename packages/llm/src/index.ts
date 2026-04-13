// ============================================================
// @anthropic-ai/cc-llm — LLM adapters and protocol translation
//
// LAYER: Adapter (depends on cc-types + cc-config, no app imports)
//
// CONSTRAINTS:
// - Pure protocol translation: Anthropic ↔ OpenAI formats
// - Gateway fetch for routing through deployment profiles
// - No dependency on @anthropic-ai/sdk (that stays in the app)
// - No dependency on React, UI, or session state
// ============================================================

export * from './openai-compat.js'
export * from './gateway-fetch.js'
