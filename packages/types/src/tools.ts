// ============================================================
// Tool types — provider-agnostic tool definitions
//
// CONSTRAINTS:
// - No dependency on Anthropic SDK types
// - No UI/rendering concerns — pure execution interface
// - Zod schemas for input validation
//
// The existing CC `Tool` type (src/Tool.ts) is a CLI-Host-specific
// superset with React rendering, permissions UI, etc. This package
// defines the Host-agnostic core that ALL Hosts share.
// ============================================================

import type { z } from 'zod'

// ---------------------------------------------------------------------------
// Tool Definition (schema + metadata)
// ---------------------------------------------------------------------------

export interface ToolDefinition {
  name: string
  description: string
  inputSchema: z.ZodType<unknown>
  aliases?: string[]
}

export interface ToolInputJSONSchema {
  [x: string]: unknown
  type: 'object'
  properties?: {
    [x: string]: unknown
  }
}

// ---------------------------------------------------------------------------
// Tool Invocation (what the LLM returns)
// ---------------------------------------------------------------------------

export interface ToolUse {
  id: string
  name: string
  input: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Execution Context (Host-agnostic)
// ---------------------------------------------------------------------------

export interface ToolContext {
  cwd: string
  abortSignal?: AbortSignal
  sessionId: string
  messages: readonly { role: string; content: unknown }[]
}

// ---------------------------------------------------------------------------
// Execution Result
// ---------------------------------------------------------------------------

export interface ToolExecutionResult {
  content: string | { type: string; [key: string]: unknown }[]
  isError?: boolean
}

export interface ToolResultData<T = unknown> {
  data: T
  error?: string
  metadata?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// ExecutableTool — the Host-agnostic tool contract
//
// This is what a tool looks like to the Core agent loop:
// - Has a name, description, and input schema
// - Can execute with a ToolContext and return a result
// - Declares concurrency safety
// - Declares read-only status
//
// Host-specific tools (CLI Tool, Electron Tool, etc.) implement
// this interface and may add Host-specific capabilities (UI rendering,
// permission dialogs, etc.)
// ---------------------------------------------------------------------------

export interface ExecutableTool<Input = Record<string, unknown>> {
  readonly name: string
  readonly aliases?: string[]

  readonly inputSchema: z.ZodType<Input>
  readonly inputJSONSchema?: ToolInputJSONSchema

  description(input: Input): Promise<string> | string

  execute(
    input: Input,
    context: ToolContext,
  ): Promise<ToolExecutionResult>

  isConcurrencySafe(input: Input): boolean
  isReadOnly(input: Input): boolean
  isEnabled(): boolean
}

export type ConcurrencyMode = 'safe' | 'exclusive'
