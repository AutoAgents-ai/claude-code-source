// ============================================================
// API Provider detection — which LLM backend is active
//
// CONSTRAINTS:
// - Only depends on gateway.ts and env.ts within this package
// - No app-level imports (analytics, auth, etc.)
// ============================================================

import { isEnvTruthy } from './env.js'
import { getGatewayConfig } from './gateway.js'

export type NativeAPIProvider = 'firstParty' | 'bedrock' | 'vertex' | 'foundry'
export type APIProvider = NativeAPIProvider | 'openai-compat'

export function getAPIProvider(): APIProvider {
  const gatewayConfig = getGatewayConfig()
  if (gatewayConfig.model.provider === 'openai-compat') {
    return 'openai-compat'
  }

  return isEnvTruthy(process.env.CLAUDE_CODE_USE_BEDROCK)
    ? 'bedrock'
    : isEnvTruthy(process.env.CLAUDE_CODE_USE_VERTEX)
      ? 'vertex'
      : isEnvTruthy(process.env.CLAUDE_CODE_USE_FOUNDRY)
        ? 'foundry'
        : 'firstParty'
}

export function isFirstPartyAnthropicBaseUrl(): boolean {
  if (getAPIProvider() === 'openai-compat') {
    return false
  }
  const baseUrl = process.env.ANTHROPIC_BASE_URL
  if (!baseUrl) {
    return true
  }
  try {
    const host = new URL(baseUrl).host
    const allowedHosts = ['api.anthropic.com']
    if (process.env.USER_TYPE === 'ant') {
      allowedHosts.push('api-staging.anthropic.com')
    }
    return allowedHosts.includes(host)
  } catch {
    return false
  }
}
