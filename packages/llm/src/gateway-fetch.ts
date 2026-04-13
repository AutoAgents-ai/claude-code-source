// ============================================================
// Gateway Fetch — custom fetch injected into Anthropic SDK
//
// LAYER: Services / Adapter
//
// CONSTRAINTS:
// - Injected via Anthropic SDK's `fetch` constructor option
// - SDK thinks it's talking to api.anthropic.com; this fetch
//   intercepts, translates protocol, and forwards to the target
// - Must return a Response that the SDK can parse as if it came
//   from the real Anthropic API
//
// RELATED: src/services/adapter/openai-compat.ts (translation)
//          src/services/api/client.ts (injection point)
//          src/config/gateway.ts (configuration)
// ============================================================

import type { GatewayModelConfig } from '@anthropic-ai/cc-config'
import {
  translateRequest,
  translateResponse,
  createTranslatingStream,
  estimateRequestTokens,
} from './openai-compat.js'

/**
 * Creates a custom `fetch` function for the Anthropic SDK that transparently
 * translates Anthropic Messages API ↔ OpenAI Chat Completions API.
 *
 * The SDK constructs requests in Anthropic format and calls this fetch.
 * We translate the request to OpenAI format, send to the target model,
 * and translate the response back to Anthropic format.
 */
export function createGatewayFetch(
  config: GatewayModelConfig,
): typeof globalThis.fetch {
  const modelName = config.modelName || 'unknown'
  const baseUrl = config.baseUrl.replace(/\/+$/, '')
  const apiKey = config.apiKey || ''

  return async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url

    // Route by URL path
    if (url.includes('/count_tokens') || url.includes('/count-tokens')) {
      return handleCountTokens(init, modelName)
    }

    // All other paths (primarily /v1/messages) → translate to Chat Completions
    return handleMessages(init, baseUrl, apiKey, modelName)
  }
}

async function handleCountTokens(
  init: RequestInit | undefined,
  modelName: string,
): Promise<Response> {
  try {
    const body = JSON.parse((init?.body as string) || '{}')
    const result = estimateRequestTokens(body)
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'x-request-id': `req_estimate_${Date.now()}`,
      },
    })
  } catch (err) {
    return new Response(JSON.stringify({ input_tokens: 0 }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
}

async function handleMessages(
  init: RequestInit | undefined,
  baseUrl: string,
  apiKey: string,
  modelName: string,
): Promise<Response> {
  const anthropicBody = JSON.parse((init?.body as string) || '{}')
  const isStreaming = !!anthropicBody.stream
  const openaiBody = translateRequest(anthropicBody, modelName)
  const targetUrl = `${baseUrl}/chat/completions`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }

  const response = await globalThis.fetch(targetUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(openaiBody),
    signal: init?.signal,
  })

  if (!response.ok) {
    // Translate OpenAI error format to Anthropic error format
    const errorBody = await response.text()
    let errorMessage: string
    try {
      const parsed = JSON.parse(errorBody)
      errorMessage = parsed.error?.message || parsed.message || errorBody
    } catch {
      errorMessage = errorBody
    }

    return new Response(
      JSON.stringify({
        type: 'error',
        error: {
          type: mapHttpStatusToAnthropicError(response.status),
          message: errorMessage,
        },
      }),
      {
        status: response.status,
        headers: {
          'content-type': 'application/json',
          'x-request-id': `req_err_${Date.now()}`,
        },
      },
    )
  }

  if (isStreaming) {
    // Pipe OpenAI SSE → TransformStream → Anthropic SSE
    if (!response.body) {
      return emptyStreamResponse(modelName)
    }
    const translatedBody = response.body.pipeThrough(
      createTranslatingStream(modelName),
    )
    return new Response(translatedBody, {
      status: 200,
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        'x-request-id': `req_stream_${Date.now()}`,
      },
    })
  } else {
    // Non-streaming: translate full response
    const openaiResult = await response.json()
    const anthropicResult = translateResponse(openaiResult, modelName)
    return new Response(JSON.stringify(anthropicResult), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'x-request-id': `req_${Date.now()}`,
      },
    })
  }
}

function mapHttpStatusToAnthropicError(status: number): string {
  switch (status) {
    case 400:
      return 'invalid_request_error'
    case 401:
      return 'authentication_error'
    case 403:
      return 'permission_error'
    case 404:
      return 'not_found_error'
    case 429:
      return 'rate_limit_error'
    case 500:
    case 502:
    case 503:
      return 'api_error'
    case 529:
      return 'overloaded_error'
    default:
      return 'api_error'
  }
}

function emptyStreamResponse(modelName: string): Response {
  const events = [
    `event: message_start\ndata: ${JSON.stringify({
      type: 'message_start',
      message: {
        id: 'msg_empty',
        type: 'message',
        role: 'assistant',
        model: modelName,
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 0, output_tokens: 0 },
      },
    })}\n\n`,
    `event: content_block_start\ndata: ${JSON.stringify({
      type: 'content_block_start',
      index: 0,
      content_block: { type: 'text', text: '' },
    })}\n\n`,
    `event: content_block_stop\ndata: ${JSON.stringify({
      type: 'content_block_stop',
      index: 0,
    })}\n\n`,
    `event: message_delta\ndata: ${JSON.stringify({
      type: 'message_delta',
      delta: { stop_reason: 'end_turn' },
      usage: { output_tokens: 0 },
    })}\n\n`,
    `event: message_stop\ndata: ${JSON.stringify({
      type: 'message_stop',
    })}\n\n`,
  ].join('')

  const encoder = new TextEncoder()
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(events))
        controller.close()
      },
    }),
    {
      status: 200,
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
      },
    },
  )
}
