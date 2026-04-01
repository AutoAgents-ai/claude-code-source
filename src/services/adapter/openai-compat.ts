// ============================================================
// OpenAI-Compatible Protocol Adapter — pure translation layer
//
// LAYER: Services / Adapter
//
// CONSTRAINTS:
// - Pure functions, no side effects, no external state
// - Input/output are plain JSON objects, not SDK types
// - Operates at HTTP body level: Anthropic JSON ↔ OpenAI JSON
// - Streaming: Anthropic SSE bytes ↔ OpenAI SSE bytes
//
// DESIGN DOC: docs/openai-compat-adapter-spec.md
// RELATED: src/services/adapter/gateway-fetch.ts (consumer)
// ============================================================

// ---------------------------------------------------------------------------
// Request Translation: Anthropic Messages → OpenAI Chat Completions
// ---------------------------------------------------------------------------

function extractSystemText(system: any): string {
  if (!system) return ''
  if (typeof system === 'string') return system
  if (Array.isArray(system)) {
    return system
      .map((b: any) => {
        if (typeof b === 'string') return b
        if (b.type === 'text') return b.text
        return ''
      })
      .filter(Boolean)
      .join('\n')
  }
  return ''
}

function stripCacheControl(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(stripCacheControl)
  const { cache_control, ...rest } = obj
  const result: any = {}
  for (const [k, v] of Object.entries(rest)) {
    result[k] = stripCacheControl(v)
  }
  return result
}

function translateContentToOpenAI(
  content: any,
  role: string,
): { content?: any; tool_calls?: any[]; tool_call_id?: string; role: string } {
  if (typeof content === 'string') {
    return { role, content }
  }
  if (!Array.isArray(content)) {
    return { role, content: String(content ?? '') }
  }

  const textParts: any[] = []
  const toolCalls: any[] = []
  let toolCallId: string | undefined

  for (const block of content) {
    switch (block.type) {
      case 'text':
        textParts.push({ type: 'text', text: block.text })
        break
      case 'image': {
        const src = block.source
        if (src?.type === 'base64') {
          textParts.push({
            type: 'image_url',
            image_url: {
              url: `data:${src.media_type};base64,${src.data}`,
            },
          })
        } else if (src?.type === 'url') {
          textParts.push({
            type: 'image_url',
            image_url: { url: src.url },
          })
        }
        break
      }
      case 'tool_use':
        toolCalls.push({
          id: block.id,
          type: 'function',
          function: {
            name: block.name,
            arguments:
              typeof block.input === 'string'
                ? block.input
                : JSON.stringify(block.input ?? {}),
          },
        })
        break
      case 'tool_result': {
        toolCallId = block.tool_use_id
        const resultContent =
          typeof block.content === 'string'
            ? block.content
            : Array.isArray(block.content)
              ? block.content
                  .map((c: any) => (c.type === 'text' ? c.text : ''))
                  .join('')
              : JSON.stringify(block.content ?? '')
        return { role: 'tool', tool_call_id: toolCallId, content: resultContent }
      }
      case 'thinking':
        // Thinking blocks in history are stripped (reasoning is ephemeral)
        break
      default:
        break
    }
  }

  const msg: any = { role }
  if (textParts.length === 1 && textParts[0].type === 'text' && toolCalls.length === 0) {
    msg.content = textParts[0].text
  } else if (textParts.length > 0) {
    msg.content = textParts
  }
  if (toolCalls.length > 0) {
    msg.tool_calls = toolCalls
  }
  return msg
}

function translateMessages(messages: any[]): any[] {
  const result: any[] = []
  for (const msg of messages) {
    const translated = translateContentToOpenAI(msg.content, msg.role)
    result.push(translated)
  }
  return result
}

function translateTools(tools: any[]): any[] | undefined {
  if (!tools?.length) return undefined
  return tools.map((t: any) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }))
}

function translateToolChoice(
  toolChoice: any,
): string | { type: string; function: { name: string } } | undefined {
  if (!toolChoice) return undefined
  if (toolChoice.type === 'auto') return 'auto'
  if (toolChoice.type === 'any') return 'required'
  if (toolChoice.type === 'none') return 'none'
  if (toolChoice.type === 'tool' && toolChoice.name) {
    return { type: 'function', function: { name: toolChoice.name } }
  }
  return undefined
}

function applyThinkingParams(body: any, modelName: string, thinking: any): void {
  if (!thinking || thinking.type !== 'enabled') return
  const lower = modelName.toLowerCase()
  if (lower.includes('qwen')) {
    body.enable_thinking = true
  } else if (lower.includes('deepseek')) {
    // DeepSeek reasoning is enabled via model name (deepseek-reasoner)
  } else if (lower.includes('glm') && lower.includes('thinking')) {
    // GLM thinking is enabled via model name
  }
  // Kimi k1.5 auto-enables thinking
}

export function translateRequest(anthropicBody: any, modelName: string): any {
  const body = stripCacheControl(anthropicBody)
  const openaiMessages: any[] = []

  const systemText = extractSystemText(body.system)
  if (systemText) {
    openaiMessages.push({ role: 'system', content: systemText })
  }

  if (body.messages) {
    openaiMessages.push(...translateMessages(body.messages))
  }

  const result: any = {
    model: modelName,
    messages: openaiMessages,
    stream: !!body.stream,
  }

  if (body.max_tokens != null) result.max_tokens = body.max_tokens
  if (body.temperature != null) result.temperature = body.temperature
  if (body.top_p != null) result.top_p = body.top_p
  if (body.stop_sequences) result.stop = body.stop_sequences

  const tools = translateTools(body.tools)
  if (tools) result.tools = tools

  const toolChoice = translateToolChoice(body.tool_choice)
  if (toolChoice !== undefined) result.tool_choice = toolChoice

  if (body.stream) {
    result.stream_options = { include_usage: true }
  }

  applyThinkingParams(result, modelName, body.thinking)

  return result
}

// ---------------------------------------------------------------------------
// Response Translation: OpenAI Chat Completions → Anthropic Messages
// ---------------------------------------------------------------------------

function finishReasonToStopReason(reason: string | null): string | null {
  switch (reason) {
    case 'stop':
      return 'end_turn'
    case 'length':
      return 'max_tokens'
    case 'tool_calls':
      return 'tool_use'
    case 'content_filter':
      return 'end_turn'
    default:
      return reason
  }
}

function safeJsonParse(str: string): any {
  try {
    return JSON.parse(str)
  } catch {
    return {}
  }
}

export function translateResponse(openaiResponse: any, modelName: string): any {
  const choice = openaiResponse.choices?.[0]
  if (!choice) {
    return {
      id: `msg_${openaiResponse.id || 'unknown'}`,
      type: 'message',
      role: 'assistant',
      model: modelName,
      content: [],
      stop_reason: 'end_turn',
      usage: { input_tokens: 0, output_tokens: 0 },
    }
  }

  const content: any[] = []
  const message = choice.message

  if (message?.reasoning_content) {
    content.push({
      type: 'thinking',
      thinking: message.reasoning_content,
    })
  }

  if (message?.content) {
    content.push({ type: 'text', text: message.content })
  }

  if (message?.tool_calls) {
    for (const tc of message.tool_calls) {
      content.push({
        type: 'tool_use',
        id: tc.id,
        name: tc.function?.name,
        input: safeJsonParse(tc.function?.arguments || '{}'),
      })
    }
  }

  if (content.length === 0) {
    content.push({ type: 'text', text: '' })
  }

  const usage = openaiResponse.usage
  return {
    id: `msg_${openaiResponse.id || 'unknown'}`,
    type: 'message',
    role: 'assistant',
    model: modelName,
    content,
    stop_reason: finishReasonToStopReason(choice.finish_reason),
    stop_sequence: null,
    usage: {
      input_tokens: usage?.prompt_tokens ?? 0,
      output_tokens: usage?.completion_tokens ?? 0,
    },
  }
}

// ---------------------------------------------------------------------------
// Streaming Translation: OpenAI SSE → Anthropic SSE (TransformStream)
// ---------------------------------------------------------------------------

interface StreamState {
  isFirstChunk: boolean
  contentBlockIndex: number
  currentBlockType: 'text' | 'thinking' | 'tool_use' | null
  modelName: string
  messageId: string
  // Track OpenAI tool_calls index → Anthropic content block index
  toolCallBlockMap: Map<number, number>
  outputTokens: number
  inputTokens: number
  sseBuffer: string
}

function formatSSE(eventType: string, data: any): string {
  return `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`
}

function emitMessageStart(state: StreamState, chunk: any): string {
  const id = `msg_${chunk.id || 'unknown'}`
  state.messageId = id
  return formatSSE('message_start', {
    type: 'message_start',
    message: {
      id,
      type: 'message',
      role: 'assistant',
      model: state.modelName,
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    },
  })
}

function emitBlockStart(state: StreamState, blockType: string, extra: any = {}): string {
  const index = state.contentBlockIndex
  const block: any = { type: blockType, ...extra }
  if (blockType === 'text') block.text = ''
  if (blockType === 'thinking') {
    block.thinking = ''
    block.signature = ''
  }
  if (blockType === 'tool_use') {
    block.id = extra.id || ''
    block.name = extra.name || ''
    block.input = {}
  }
  return formatSSE('content_block_start', {
    type: 'content_block_start',
    index,
    content_block: block,
  })
}

function emitBlockDelta(index: number, deltaType: string, delta: any): string {
  return formatSSE('content_block_delta', {
    type: 'content_block_delta',
    index,
    delta: { type: deltaType, ...delta },
  })
}

function emitBlockStop(index: number): string {
  return formatSSE('content_block_stop', {
    type: 'content_block_stop',
    index,
  })
}

function closeCurrentBlock(state: StreamState): string {
  if (state.currentBlockType !== null) {
    const out = emitBlockStop(state.contentBlockIndex)
    state.contentBlockIndex++
    state.currentBlockType = null
    return out
  }
  return ''
}

function processStreamChunk(chunk: any, state: StreamState): string {
  let output = ''

  // First chunk → emit message_start
  if (state.isFirstChunk) {
    output += emitMessageStart(state, chunk)
    state.isFirstChunk = false
  }

  const choice = chunk.choices?.[0]
  if (!choice) {
    // Usage-only chunk (final chunk with stream_options.include_usage)
    if (chunk.usage) {
      state.inputTokens = chunk.usage.prompt_tokens ?? 0
      state.outputTokens = chunk.usage.completion_tokens ?? 0
    }
    return output
  }

  const delta = choice.delta || {}
  const finishReason = choice.finish_reason

  // Reasoning/thinking content
  if (delta.reasoning_content) {
    if (state.currentBlockType !== 'thinking') {
      output += closeCurrentBlock(state)
      state.currentBlockType = 'thinking'
      output += emitBlockStart(state, 'thinking')
    }
    output += emitBlockDelta(state.contentBlockIndex, 'thinking_delta', {
      thinking: delta.reasoning_content,
    })
  }

  // Text content
  if (delta.content) {
    if (state.currentBlockType !== 'text') {
      output += closeCurrentBlock(state)
      state.currentBlockType = 'text'
      output += emitBlockStart(state, 'text')
    }
    output += emitBlockDelta(state.contentBlockIndex, 'text_delta', {
      text: delta.content,
    })
  }

  // Tool calls
  if (delta.tool_calls) {
    for (const tc of delta.tool_calls) {
      const tcIndex = tc.index ?? 0

      if (tc.id) {
        // New tool call starting
        output += closeCurrentBlock(state)
        state.currentBlockType = 'tool_use'
        state.toolCallBlockMap.set(tcIndex, state.contentBlockIndex)
        output += emitBlockStart(state, 'tool_use', {
          id: tc.id,
          name: tc.function?.name || '',
        })
      }

      // Tool call arguments delta
      if (tc.function?.arguments) {
        const blockIndex = state.toolCallBlockMap.get(tcIndex)
        if (blockIndex !== undefined) {
          output += emitBlockDelta(blockIndex, 'input_json_delta', {
            partial_json: tc.function.arguments,
          })
        }
      }
    }
  }

  // Finish
  if (finishReason) {
    output += closeCurrentBlock(state)
    output += formatSSE('message_delta', {
      type: 'message_delta',
      delta: { stop_reason: finishReasonToStopReason(finishReason) },
      usage: { output_tokens: state.outputTokens },
    })
    output += formatSSE('message_stop', { type: 'message_stop' })
  }

  return output
}

/**
 * Creates a TransformStream that translates OpenAI SSE bytes → Anthropic SSE bytes.
 * Input: raw bytes from an OpenAI streaming response body
 * Output: raw bytes in Anthropic SSE format for the Anthropic SDK to parse
 */
export function createTranslatingStream(
  modelName: string,
): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()

  const state: StreamState = {
    isFirstChunk: true,
    contentBlockIndex: 0,
    currentBlockType: null,
    modelName,
    messageId: '',
    toolCallBlockMap: new Map(),
    outputTokens: 0,
    inputTokens: 0,
    sseBuffer: '',
  }

  return new TransformStream({
    transform(chunk, controller) {
      state.sseBuffer += decoder.decode(chunk, { stream: true })

      // Process complete SSE events (delimited by \n\n)
      let boundary: number
      while ((boundary = state.sseBuffer.indexOf('\n\n')) !== -1) {
        const event = state.sseBuffer.slice(0, boundary)
        state.sseBuffer = state.sseBuffer.slice(boundary + 2)

        if (!event.trim()) continue

        // Extract data from SSE event
        let data: string | null = null
        for (const line of event.split('\n')) {
          if (line.startsWith('data: ')) {
            data = line.slice(6)
          } else if (line.startsWith('data:')) {
            data = line.slice(5).trimStart()
          }
        }

        if (!data) continue
        if (data === '[DONE]') {
          // If we haven't emitted message_stop yet, do it now
          if (state.currentBlockType !== null || state.isFirstChunk) {
            let output = ''
            if (state.isFirstChunk) {
              output += emitMessageStart(state, { id: 'done' })
              state.isFirstChunk = false
            }
            output += closeCurrentBlock(state)
            output += formatSSE('message_delta', {
              type: 'message_delta',
              delta: { stop_reason: 'end_turn' },
              usage: { output_tokens: state.outputTokens },
            })
            output += formatSSE('message_stop', { type: 'message_stop' })
            controller.enqueue(encoder.encode(output))
          }
          continue
        }

        try {
          const parsed = JSON.parse(data)
          const translated = processStreamChunk(parsed, state)
          if (translated) {
            controller.enqueue(encoder.encode(translated))
          }
        } catch {
          // Skip malformed JSON chunks
        }
      }
    },

    flush(controller) {
      // Handle any remaining buffer
      if (state.sseBuffer.trim()) {
        let data: string | null = null
        for (const line of state.sseBuffer.split('\n')) {
          if (line.startsWith('data: ')) {
            data = line.slice(6)
          }
        }
        if (data && data !== '[DONE]') {
          try {
            const parsed = JSON.parse(data)
            const translated = processStreamChunk(parsed, state)
            if (translated) {
              controller.enqueue(encoder.encode(translated))
            }
          } catch {
            // ignore
          }
        }
      }

      // Ensure stream is properly closed
      if (state.currentBlockType !== null) {
        let output = closeCurrentBlock(state)
        output += formatSSE('message_delta', {
          type: 'message_delta',
          delta: { stop_reason: 'end_turn' },
          usage: { output_tokens: state.outputTokens },
        })
        output += formatSSE('message_stop', { type: 'message_stop' })
        controller.enqueue(encoder.encode(output))
      }
    },
  })
}

// ---------------------------------------------------------------------------
// Token Estimation (rough, for context window management)
// ---------------------------------------------------------------------------

/**
 * Rough token count estimate: ~4 characters per token for English,
 * ~2 characters per token for CJK. Uses a blended heuristic.
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0
  // Count CJK characters (roughly 2 chars per token)
  const cjkCount = (text.match(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g) || []).length
  const nonCjkLength = text.length - cjkCount
  return Math.ceil(nonCjkLength / 4 + cjkCount / 2)
}

/**
 * Estimate token count for a full Anthropic Messages request body.
 * Returns a response in the same shape as beta.messages.countTokens.
 */
export function estimateRequestTokens(body: any): any {
  let total = 0

  // System prompt
  const systemText = extractSystemText(body.system)
  total += estimateTokenCount(systemText)

  // Messages
  if (body.messages) {
    for (const msg of body.messages) {
      if (typeof msg.content === 'string') {
        total += estimateTokenCount(msg.content)
      } else if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === 'text') {
            total += estimateTokenCount(block.text || '')
          } else if (block.type === 'tool_result') {
            const c = block.content
            total += estimateTokenCount(typeof c === 'string' ? c : JSON.stringify(c ?? ''))
          } else if (block.type === 'tool_use') {
            total += estimateTokenCount(JSON.stringify(block.input ?? {}))
            total += estimateTokenCount(block.name || '')
          }
        }
      }
    }
  }

  // Tools schema
  if (body.tools) {
    total += estimateTokenCount(JSON.stringify(body.tools))
  }

  return { input_tokens: total }
}
