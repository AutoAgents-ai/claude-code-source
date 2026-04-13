// ============================================================
// API Provider — re-export from @anthropic-ai/cc-config + app-specific helpers
//
// CONSTRAINTS:
// - Core provider detection is in packages/config
// - Analytics-specific adapter stays here (app-level concern)
// ============================================================

import type { AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS } from '../../services/analytics/index.js'

export {
  type NativeAPIProvider,
  type APIProvider,
  getAPIProvider,
  isFirstPartyAnthropicBaseUrl,
} from '@anthropic-ai/cc-config'

import { getAPIProvider } from '@anthropic-ai/cc-config'

export function getAPIProviderForStatsig(): AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS {
  return getAPIProvider() as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
}
