// ============================================================
// Host interface — the contract every deployment target implements
//
// CONSTRAINTS:
// - Host assembles Ports (LLM, Tools, Session, UI)
// - Host owns the process lifecycle (start/shutdown)
// - Host does NOT run the agent loop — Core does that via Ports
// - Host provides a SessionRuntime for the agent loop
//
// Pattern:
//   const host = new CLIHost(config)
//   await host.start()
//   const ports = await host.createPorts()
//   const session = host.createSession(sessionConfig)
//   // Core.query(ports, session) → yields AgentEvents → host renders
//   await host.shutdown()
//
// Known Host types:
// - CLIHost: Terminal UI (current CC, React/Ink TUI)
// - ElectronHost: Desktop app (future Lingda terminal)
// - DaemonHost: Background agent service
// - SDKHost: Programmatic/headless (QueryEngine)
// ============================================================

import type { Ports, SessionConfig, SessionRuntime } from '@anthropic-ai/cc-types'

export interface HostConfig {
  cwd: string
  model?: string
  isInteractive?: boolean
  [key: string]: unknown
}

export interface Host {
  readonly name: string

  createPorts(config: HostConfig): Promise<Ports>

  createSession(config: SessionConfig): SessionRuntime

  start(): Promise<void>

  shutdown(): Promise<void>
}
