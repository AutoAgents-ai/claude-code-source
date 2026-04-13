// ============================================================
// Session types — session state and configuration
//
// CONSTRAINTS:
// - Serializable for persistence (JSON-safe)
// - No process-level globals — each session is an instance
// ============================================================

export interface SessionConfig {
  sessionId: string
  cwd: string
  projectRoot: string
  model: string
  isInteractive: boolean
}

export interface SessionState {
  sessionId: string
  cwd: string
  projectRoot: string
  model: string
  isInteractive: boolean
  totalCostUSD: number
  totalInputTokens: number
  totalOutputTokens: number
  startTime: number
  lastInteractionTime: number
}

export interface CostEntry {
  model: string
  inputTokens: number
  outputTokens: number
  costUSD: number
  durationMs: number
}
