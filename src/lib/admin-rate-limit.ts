/**
 * Simple in-memory rate limiter for admin routes.
 * Uses a Map to track request counts per admin per window.
 *
 * Limits:
 * - General: 60 req/min per admin user
 * - Sensitive actions (delete, impersonate, promote): 10 req/min
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up expired entries periodically
const CLEANUP_INTERVAL = 120_000 // 2 minutes
let lastCleanup = Date.now()

function cleanupExpired() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  for (const [key, entry] of rateLimitStore) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key)
    }
  }
}

const SENSITIVE_ACTIONS = new Set([
  'delete',
  'impersonate',
  'promote',
  'demote',
  'suspend',
  'force-logout',
  'reset-password',
])

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

/**
 * Check if an admin action is within rate limits.
 *
 * @param adminId - The admin user's ID
 * @param action - Optional action name for sensitive rate limiting
 * @returns { allowed, remaining, resetAt }
 */
export function checkAdminRateLimit(
  adminId: string,
  action?: string,
): RateLimitResult {
  cleanupExpired()

  const isSensitive = action ? SENSITIVE_ACTIONS.has(action) : false
  const limit = isSensitive ? 10 : 60
  const windowMs = 60_000 // 1 minute

  const key = isSensitive ? `${adminId}:sensitive` : `${adminId}:general`
  const now = Date.now()

  const entry = rateLimitStore.get(key)

  if (!entry || entry.resetAt <= now) {
    // New window
    const resetAt = now + windowMs
    rateLimitStore.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: limit - 1, resetAt }
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return {
    allowed: true,
    remaining: limit - entry.count,
    resetAt: entry.resetAt,
  }
}
