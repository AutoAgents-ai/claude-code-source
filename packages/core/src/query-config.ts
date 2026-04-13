// ============================================================
// QueryConfig — immutable snapshot for one query() invocation
//
// Mirrors CC's src/query/config.ts pattern:
// "Immutable values snapshotted once at query() entry.
//  A pure reducer can take (state, event, config)."
//
// CONSTRAINTS:
// - Plain data, no functions or closures
// - Frozen at query() entry, never mutated during the loop
// ============================================================

export interface QueryConfig {
  sessionId: string

  gates: {
    streamingToolExecution: boolean
    emitToolUseSummaries: boolean
  }

  limits: {
    maxTurns?: number
    maxTokenBudget?: number
    maxToolConcurrency: number
  }
}

export function defaultQueryConfig(sessionId: string): QueryConfig {
  return {
    sessionId,
    gates: {
      streamingToolExecution: true,
      emitToolUseSummaries: false,
    },
    limits: {
      maxToolConcurrency: 10,
    },
  }
}
