// ============================================================
// Agent events — yielded by the query loop, consumed by Hosts
//
// CONSTRAINTS:
// - Serializable (JSON-safe) for cross-process transport (IPC, SSE)
// - No React/UI types — Hosts map events to their own rendering
// ============================================================

import type { AssistantMessage, TokenUsage } from './messages.js'
import type { ToolUse } from './tools.js'

export type AgentEvent =
  | StreamStartEvent
  | StreamTextEvent
  | StreamThinkingEvent
  | StreamToolUseStartEvent
  | StreamToolResultEvent
  | MessageCompleteEvent
  | TurnCompleteEvent
  | ErrorEvent
  | CompactionEvent

export interface StreamStartEvent {
  type: 'stream_start'
  model: string
  requestId?: string
}

export interface StreamTextEvent {
  type: 'stream_text'
  text: string
}

export interface StreamThinkingEvent {
  type: 'stream_thinking'
  thinking: string
}

export interface StreamToolUseStartEvent {
  type: 'stream_tool_use_start'
  toolUse: ToolUse
}

export interface StreamToolResultEvent {
  type: 'stream_tool_result'
  toolUseId: string
  result: {
    content: string | { type: string; [key: string]: unknown }[]
    isError?: boolean
  }
}

export interface MessageCompleteEvent {
  type: 'message_complete'
  message: AssistantMessage
  usage?: TokenUsage
}

export interface TurnCompleteEvent {
  type: 'turn_complete'
  reason: 'end_turn' | 'max_tokens' | 'abort' | 'error'
  totalUsage?: TokenUsage
}

export interface ErrorEvent {
  type: 'error'
  error: {
    code: string
    message: string
    retryable?: boolean
  }
}

export interface CompactionEvent {
  type: 'compaction'
  fromTokens: number
  toTokens: number
}
