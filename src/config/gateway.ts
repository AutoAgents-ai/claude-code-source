// ============================================================
// Gateway Config — deployment profile & service routing
//
// LAYER: Config (foundation, no business logic imports)
//
// CONSTRAINTS:
// - Only imports from envUtils — must not import model/, auth/,
//   analytics/, or any business module to avoid circular deps
// - Singleton: loaded once on first access, cached for process lifetime
// - Env vars override profile defaults (higher priority wins)
//
// DESIGN DOC: docs/openai-compat-adapter-spec.md
// ============================================================

import { isEnvTruthy } from 'src/utils/envUtils.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RoutePolicy {
  enabled: boolean
  rewriteBaseUrl?: string
}

export interface GatewayModelConfig {
  provider: 'anthropic' | 'openai-compat' | 'bedrock' | 'vertex' | 'foundry'
  baseUrl: string
  apiKey?: string
  modelName?: string
  maxContextTokens?: number
}

export interface GatewayRoutes {
  telemetry: RoutePolicy
  datadog: RoutePolicy
  featureFlags: RoutePolicy
  autoUpdate: RoutePolicy
  oauth: RoutePolicy
  billing: RoutePolicy
  settingsSync: RoutePolicy
  teamMemorySync: RoutePolicy
  remoteManagedSettings: RoutePolicy
  chromeBridge: RoutePolicy
  pluginCdn: RoutePolicy
  releaseNotes: RoutePolicy
  feedback: RoutePolicy
  voiceStt: RoutePolicy
  mcpProxy: RoutePolicy
}

export interface GatewayBrandConfig {
  configDir: string
  userAgent: string
}

export interface GatewayConfig {
  model: GatewayModelConfig
  routes: GatewayRoutes
  brand: GatewayBrandConfig
}

// ---------------------------------------------------------------------------
// Profile defaults
// ---------------------------------------------------------------------------

const ALL_ROUTES_ENABLED: GatewayRoutes = {
  telemetry: { enabled: true },
  datadog: { enabled: true },
  featureFlags: { enabled: true },
  autoUpdate: { enabled: true },
  oauth: { enabled: true },
  billing: { enabled: true },
  settingsSync: { enabled: true },
  teamMemorySync: { enabled: true },
  remoteManagedSettings: { enabled: true },
  chromeBridge: { enabled: true },
  pluginCdn: { enabled: true },
  releaseNotes: { enabled: true },
  feedback: { enabled: true },
  voiceStt: { enabled: true },
  mcpProxy: { enabled: true },
}

const ALL_ROUTES_DISABLED: GatewayRoutes = {
  telemetry: { enabled: false },
  datadog: { enabled: false },
  featureFlags: { enabled: false },
  autoUpdate: { enabled: false },
  oauth: { enabled: false },
  billing: { enabled: false },
  settingsSync: { enabled: false },
  teamMemorySync: { enabled: false },
  remoteManagedSettings: { enabled: false },
  chromeBridge: { enabled: false },
  pluginCdn: { enabled: false },
  releaseNotes: { enabled: false },
  feedback: { enabled: false },
  voiceStt: { enabled: false },
  mcpProxy: { enabled: false },
}

const PROFILES: Record<string, GatewayConfig> = {
  anthropic: {
    model: { provider: 'anthropic', baseUrl: 'https://api.anthropic.com' },
    routes: { ...ALL_ROUTES_ENABLED },
    brand: { configDir: '.claude', userAgent: 'claude-cli' },
  },
  private: {
    model: {
      provider: 'openai-compat',
      baseUrl: '',
      apiKey: '',
      modelName: '',
    },
    routes: { ...ALL_ROUTES_DISABLED },
    brand: { configDir: '.autoagents', userAgent: 'autoagents' },
  },
  offline: {
    model: {
      provider: 'openai-compat',
      baseUrl: '',
      apiKey: '',
      modelName: '',
    },
    routes: { ...ALL_ROUTES_DISABLED },
    brand: { configDir: '.autoagents', userAgent: 'autoagents' },
  },
}

// ---------------------------------------------------------------------------
// Env var → route key mapping (explicit, no string mangling)
// ---------------------------------------------------------------------------

const ROUTE_ENV_PREFIX: Record<keyof GatewayRoutes, string> = {
  telemetry: 'CLAUDE_ROUTE_TELEMETRY',
  datadog: 'CLAUDE_ROUTE_DATADOG',
  featureFlags: 'CLAUDE_ROUTE_FEATURE_FLAGS',
  autoUpdate: 'CLAUDE_ROUTE_AUTO_UPDATE',
  oauth: 'CLAUDE_ROUTE_OAUTH',
  billing: 'CLAUDE_ROUTE_BILLING',
  settingsSync: 'CLAUDE_ROUTE_SETTINGS_SYNC',
  teamMemorySync: 'CLAUDE_ROUTE_TEAM_MEMORY_SYNC',
  remoteManagedSettings: 'CLAUDE_ROUTE_REMOTE_MANAGED_SETTINGS',
  chromeBridge: 'CLAUDE_ROUTE_CHROME_BRIDGE',
  pluginCdn: 'CLAUDE_ROUTE_PLUGIN_CDN',
  releaseNotes: 'CLAUDE_ROUTE_RELEASE_NOTES',
  feedback: 'CLAUDE_ROUTE_FEEDBACK',
  voiceStt: 'CLAUDE_ROUTE_VOICE_STT',
  mcpProxy: 'CLAUDE_ROUTE_MCP_PROXY',
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

function loadGatewayConfig(): GatewayConfig {
  const profileName = process.env.CLAUDE_DEPLOYMENT_PROFILE || 'anthropic'
  const profile = PROFILES[profileName]
  if (!profile) {
    const valid = Object.keys(PROFILES).join(', ')
    throw new Error(
      `Unknown deployment profile: ${profileName}. Valid profiles: ${valid}`,
    )
  }

  const config: GatewayConfig = JSON.parse(JSON.stringify(profile))

  // --- Model overrides ---
  if (process.env.OPENAI_COMPAT_BASE_URL) {
    config.model.provider = 'openai-compat'
    config.model.baseUrl = process.env.OPENAI_COMPAT_BASE_URL
  }
  if (process.env.OPENAI_COMPAT_API_KEY) {
    config.model.apiKey = process.env.OPENAI_COMPAT_API_KEY
  }
  if (process.env.OPENAI_COMPAT_MODEL) {
    config.model.modelName = process.env.OPENAI_COMPAT_MODEL
  }
  if (process.env.OPENAI_COMPAT_MAX_CONTEXT_TOKENS) {
    const parsed = parseInt(process.env.OPENAI_COMPAT_MAX_CONTEXT_TOKENS, 10)
    if (!Number.isNaN(parsed) && parsed > 0) {
      config.model.maxContextTokens = parsed
    }
  }

  // --- Route overrides ---
  for (const [routeKey, envPrefix] of Object.entries(ROUTE_ENV_PREFIX) as [
    keyof GatewayRoutes,
    string,
  ][]) {
    const enabledEnv = process.env[`${envPrefix}_ENABLED`]
    const baseUrlEnv = process.env[`${envPrefix}_BASE_URL`]

    if (enabledEnv !== undefined) {
      config.routes[routeKey].enabled = isEnvTruthy(enabledEnv)
    }
    if (baseUrlEnv) {
      config.routes[routeKey].rewriteBaseUrl = baseUrlEnv
    }
  }

  return config
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _config: GatewayConfig | null = null

export function getGatewayConfig(): GatewayConfig {
  if (!_config) {
    _config = loadGatewayConfig()
  }
  return _config
}

/** Reset cached config. For testing only. */
export function resetGatewayConfig(): void {
  _config = null
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

export function isRouteEnabled(route: keyof GatewayRoutes): boolean {
  return getGatewayConfig().routes[route].enabled
}

export function isOpenAICompatMode(): boolean {
  return getGatewayConfig().model.provider === 'openai-compat'
}
