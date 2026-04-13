// ============================================================
// Port interfaces — contracts between Core and Hosts
//
// LAYER: Foundation (type-only, no implementations)
//
// CONSTRAINTS:
// - Core depends ONLY on these interfaces, never on concrete adapters
// - Each Host assembles concrete implementations and injects them
// - Inspired by CC's QueryDeps pattern, expanded to full coverage
//
// DESIGN: Core (query loop) is the "Kernel" — zero I/O.
//         Ports are the "Shell" contracts.
//         Hosts assemble Shell implementations and drive the Kernel.
// ============================================================

import type { AgentEvent } from './events.js'
import type { Message, TokenUsage } from './messages.js'
import type { ToolContext, ToolDefinition, ToolExecutionResult, ToolUse } from './tools.js'

// -- LLM Port --

export interface LLMPort {
  stream(request: LLMRequest): AsyncGenerator<LLMStreamEvent>
}

export interface LLMRequest {
  messages: Message[]
  systemPrompt: string
  tools: ToolDefinition[]
  model?: string
  maxTokens?: number
  temperature?: number
  signal?: AbortSignal
}

export type LLMStreamEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'thinking_delta'; thinking: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'message_complete'; message: Message; usage?: TokenUsage; stopReason?: string }
  | { type: 'error'; error: Error }

// -- Tool Port --

export interface ToolPort {
  getDefinitions(): ToolDefinition[]
  execute(toolUse: ToolUse, context: ToolContext): Promise<ToolExecutionResult>
  isConcurrencySafe?(toolName: string, input: Record<string, unknown>): boolean
}

// -- Session Port --

export interface SessionPort {
  readonly sessionId: string

  getMessages(): Message[]
  appendMessage(msg: Message): void
  clearMessages(): void

  getCwd(): string
  setCwd(cwd: string): void

  get<K extends string>(key: K): unknown
  set<K extends string>(key: K, value: unknown): void
}

// -- UI Port (optional, Host-provided) --

export interface UIPort {
  onAgentEvent?(event: AgentEvent): void
  onToolProgress?(toolUseId: string, progress: unknown): void
  requestUserInput?(prompt: string): Promise<string>
  sendNotification?(title: string, body: string): void
}

// -- Assembled Ports --

export interface Ports {
  llm: LLMPort
  tools: ToolPort
  session: SessionPort
  ui?: UIPort
}
