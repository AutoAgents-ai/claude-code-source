// ============================================================
// Tool types — provider-agnostic tool definitions
//
// CONSTRAINTS:
// - No dependency on Anthropic SDK types
// - No UI/rendering concerns — pure execution interface
// - Zod schemas for input validation
// ============================================================

import type { z } from 'zod'

export interface ToolDefinition {
  name: string
  description: string
  inputSchema: z.ZodType<unknown>
  aliases?: string[]
}

export interface ToolUse {
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ToolResultData<T = unknown> {
  data: T
  error?: string
  metadata?: Record<string, unknown>
}

export interface ToolContext {
  cwd: string
  abortSignal?: AbortSignal
  sessionId: string
  messages: readonly { role: string; content: unknown }[]
}

export interface ToolExecutionResult {
  content: string | { type: string; [key: string]: unknown }[]
  isError?: boolean
}

export type ConcurrencyMode = 'safe' | 'exclusive'
