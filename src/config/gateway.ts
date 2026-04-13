// ============================================================
// Gateway Config — re-export from @anthropic-ai/cc-config
//
// CONSTRAINTS:
// - This file is a compatibility shim
// - All logic now lives in packages/config/src/gateway.ts
// - Existing app imports continue to work via this re-export
// ============================================================

export {
  type RoutePolicy,
  type GatewayModelConfig,
  type GatewayRoutes,
  type GatewayBrandConfig,
  type GatewayConfig,
  getGatewayConfig,
  resetGatewayConfig,
  isRouteEnabled,
  isOpenAICompatMode,
} from '@anthropic-ai/cc-config'
