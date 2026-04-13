// ============================================================
// Host interface — the contract every deployment target implements
//
// CONSTRAINTS:
// - Host assembles Ports (LLM, Tools, Session, UI)
// - Host owns the process lifecycle (start/shutdown)
// - Host does NOT run the agent loop — Core does that via Ports
//
// Pattern: Host.createPorts() → Core.query(ports) → Host.renderEvents()
// ============================================================

import type { Ports } from '@anthropic-ai/cc-types'

export interface HostConfig {
  cwd: string
  model?: string
  isInteractive?: boolean
  [key: string]: unknown
}

export interface Host {
  readonly name: string

  createPorts(config: HostConfig): Promise<Ports>

  start(): Promise<void>

  shutdown(): Promise<void>
}
