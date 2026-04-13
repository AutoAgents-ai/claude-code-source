// ============================================================
// Message types — internal message format for the agent loop
//
// CONSTRAINTS:
// - Provider-agnostic: NOT Anthropic SDK types
// - Convertible to/from provider-specific formats via adapters
// - Must support: text, tool_use, tool_result, thinking, images
// ============================================================

export type MessageRole = 'user' | 'assistant' | 'system'

export interface ContentBlock {
  type: string
  [key: string]: unknown
}

export interface TextBlock extends ContentBlock {
  type: 'text'
  text: string
}

export interface ToolUseBlock extends ContentBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ToolResultBlock extends ContentBlock {
  type: 'tool_result'
  tool_use_id: string
  content: string | ContentBlock[]
  is_error?: boolean
}

export interface ThinkingBlock extends ContentBlock {
  type: 'thinking'
  thinking: string
}

export interface ImageBlock extends ContentBlock {
  type: 'image'
  source: {
    type: 'base64' | 'url'
    media_type?: string
    data?: string
    url?: string
  }
}

export type AnyContentBlock =
  | TextBlock
  | ToolUseBlock
  | ToolResultBlock
  | ThinkingBlock
  | ImageBlock
  | ContentBlock

export interface Message {
  role: MessageRole
  content: string | AnyContentBlock[]
  uuid?: string
  timestamp?: number
}

export interface UserMessage extends Message {
  role: 'user'
}

export interface AssistantMessage extends Message {
  role: 'assistant'
  stop_reason?: string
  model?: string
  usage?: TokenUsage
}

export interface SystemMessage extends Message {
  role: 'system'
}

export interface TokenUsage {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}
