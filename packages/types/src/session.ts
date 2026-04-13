// ============================================================
// Session types — session state, runtime, and configuration
//
// CONSTRAINTS:
// - SessionConfig/SessionState are serializable (JSON-safe)
// - SessionRuntime is the injectable interface that replaces
//   the global bootstrap/state singleton
// - No process-level globals — each session is an instance
//
// The existing bootstrap/state.ts has 1700+ lines and 165 getters/setters.
// SessionRuntime extracts the ESSENTIAL subset that the Core agent loop
// needs. Host-specific state stays in the Host.
// ============================================================

// ---------------------------------------------------------------------------
// Configuration (immutable after session start)
// ---------------------------------------------------------------------------

export interface SessionConfig {
  sessionId: string
  cwd: string
  projectRoot: string
  model: string
  isInteractive: boolean
}

// ---------------------------------------------------------------------------
// State (mutable, tracked by the session)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// SessionRuntime — injectable session interface for the Core agent loop
//
// This is the "Session Port" — the contract between Core and Hosts.
// The existing bootstrap/state.ts is a LegacySessionRuntime that
// implements this via get/set wrappers around the global singleton.
//
// Each Host creates a SessionRuntime instance:
// - CLI Host: wraps bootstrap/state.ts
// - Electron Host: wraps its own session store
// - Daemon Host: wraps per-connection state
// ---------------------------------------------------------------------------

export interface SessionRuntime {
  // Identity
  readonly sessionId: string

  // Working directory
  getCwd(): string
  setCwd(cwd: string): void
  getOriginalCwd(): string

  // Model
  getModel(): string
  setModel(model: string): void

  // Session mode
  isInteractive(): boolean
  isNonInteractive(): boolean

  // Cost tracking
  addCost(entry: CostEntry): void
  getTotalCost(): number
  getTotalInputTokens(): number
  getTotalOutputTokens(): number

  // Generic key-value store for Host-specific extensions
  get<T = unknown>(key: string): T | undefined
  set<T = unknown>(key: string, value: T): void
}
