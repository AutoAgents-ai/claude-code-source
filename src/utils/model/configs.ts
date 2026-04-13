// ============================================================
// Model configs — re-export from @anthropic-ai/cc-config
//
// CONSTRAINTS:
// - Compatibility shim, all logic in packages/config/src/models.ts
// - ModelName type still comes from local model.ts (app-level)
// ============================================================

export {
  type ModelConfig,
  CLAUDE_3_7_SONNET_CONFIG,
  CLAUDE_3_5_V2_SONNET_CONFIG,
  CLAUDE_3_5_HAIKU_CONFIG,
  CLAUDE_HAIKU_4_5_CONFIG,
  CLAUDE_SONNET_4_CONFIG,
  CLAUDE_SONNET_4_5_CONFIG,
  CLAUDE_SONNET_4_6_CONFIG,
  CLAUDE_OPUS_4_CONFIG,
  CLAUDE_OPUS_4_1_CONFIG,
  CLAUDE_OPUS_4_5_CONFIG,
  CLAUDE_OPUS_4_6_CONFIG,
  ALL_MODEL_CONFIGS,
  type ModelKey,
  type CanonicalModelId,
  CANONICAL_MODEL_IDS,
  CANONICAL_ID_TO_KEY,
} from '@anthropic-ai/cc-config'
