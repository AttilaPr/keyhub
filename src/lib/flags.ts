import { createHash } from 'crypto'
import prisma from '@/lib/prisma'
import type { FeatureFlag } from '@prisma/client'

/**
 * Check whether a feature flag is enabled for a given user.
 *
 * Resolution order:
 *  1. If the flag does not exist -> false
 *  2. If userId is in allowedUserIds -> true
 *  3. If rolloutPercent > 0 and userId is provided, hash-based bucket check
 *  4. Fall back to the global `enabled` boolean
 */
export async function isEnabled(
  flagKey: string,
  userId?: string
): Promise<boolean> {
  const flag = await prisma.featureFlag.findUnique({
    where: { key: flagKey },
  })

  if (!flag) return false

  // User-level override
  if (userId && flag.allowedUserIds.includes(userId)) {
    return true
  }

  // Percentage-based rollout (requires a userId to bucket)
  if (userId && flag.rolloutPercent > 0) {
    const hash = createHash('sha256')
      .update(`${userId}:${flagKey}`)
      .digest('hex')
    const bucket = parseInt(hash.substring(0, 8), 16) % 100
    if (bucket < flag.rolloutPercent) {
      return true
    }
  }

  return flag.enabled
}

/**
 * Return every feature flag, ordered by key.
 */
export async function getAllFlags(): Promise<FeatureFlag[]> {
  return prisma.featureFlag.findMany({
    orderBy: { key: 'asc' },
  })
}
