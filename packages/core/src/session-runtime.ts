// ============================================================
// InMemorySessionRuntime — reference implementation of SessionRuntime
//
// LAYER: Core
//
// CONSTRAINTS:
// - No dependency on bootstrap/state.ts
// - Suitable for: testing, new Hosts, lightweight sessions
// - For CLI Host: use LegacySessionAdapter (wraps bootstrap/state)
// ============================================================

import type { CostEntry, SessionConfig, SessionRuntime } from '@anthropic-ai/cc-types'

export class InMemorySessionRuntime implements SessionRuntime {
  readonly sessionId: string
  private _cwd: string
  private readonly _originalCwd: string
  private _model: string
  private _isInteractive: boolean
  private _totalCostUSD = 0
  private _totalInputTokens = 0
  private _totalOutputTokens = 0
  private _store = new Map<string, unknown>()

  constructor(config: SessionConfig) {
    this.sessionId = config.sessionId
    this._cwd = config.cwd
    this._originalCwd = config.cwd
    this._model = config.model
    this._isInteractive = config.isInteractive
  }

  getCwd(): string {
    return this._cwd
  }

  setCwd(cwd: string): void {
    this._cwd = cwd
  }

  getOriginalCwd(): string {
    return this._originalCwd
  }

  getModel(): string {
    return this._model
  }

  setModel(model: string): void {
    this._model = model
  }

  isInteractive(): boolean {
    return this._isInteractive
  }

  isNonInteractive(): boolean {
    return !this._isInteractive
  }

  addCost(entry: CostEntry): void {
    this._totalCostUSD += entry.costUSD
    this._totalInputTokens += entry.inputTokens
    this._totalOutputTokens += entry.outputTokens
  }

  getTotalCost(): number {
    return this._totalCostUSD
  }

  getTotalInputTokens(): number {
    return this._totalInputTokens
  }

  getTotalOutputTokens(): number {
    return this._totalOutputTokens
  }

  get<T = unknown>(key: string): T | undefined {
    return this._store.get(key) as T | undefined
  }

  set<T = unknown>(key: string, value: T): void {
    this._store.set(key, value)
  }
}
