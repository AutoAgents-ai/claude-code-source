// ============================================================
// AbstractHost — base class with common Host boilerplate
//
// LAYER: Core
//
// CONSTRAINTS:
// - Provides InMemorySessionRuntime as default createSession()
// - Subclasses must implement createPorts(), start(), shutdown()
// ============================================================

import type { Ports, SessionConfig, SessionRuntime } from '@anthropic-ai/cc-types'
import type { Host, HostConfig } from './host.js'
import { InMemorySessionRuntime } from './session-runtime.js'

export abstract class AbstractHost implements Host {
  abstract readonly name: string

  abstract createPorts(config: HostConfig): Promise<Ports>

  createSession(config: SessionConfig): SessionRuntime {
    return new InMemorySessionRuntime(config)
  }

  abstract start(): Promise<void>

  abstract shutdown(): Promise<void>
}
