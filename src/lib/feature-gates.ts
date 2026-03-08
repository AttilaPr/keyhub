import { isEnabled } from '@/lib/flags'

// ---- Feature flag key constants ----
export const FEATURE_TEAMS = 'feature_teams'
export const FEATURE_PLAYGROUND = 'feature_playground'
export const FEATURE_SEMANTIC_CACHE = 'feature_semantic_cache'
export const FEATURE_ANOMALY_DETECTION = 'feature_anomaly_detection'
export const FEATURE_WEBHOOKS = 'feature_webhooks'
export const FEATURE_MFA = 'feature_mfa'

/**
 * Check whether a feature is enabled for a given user.
 * Simple wrapper around `isEnabled` for use in application code.
 */
export async function isFeatureEnabled(
  flagKey: string,
  userId: string,
): Promise<boolean> {
  return isEnabled(flagKey, userId)
}
