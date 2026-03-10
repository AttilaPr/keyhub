import prisma from '@/lib/prisma'

interface RateLimitConfig {
  /** Max attempts within the window */
  maxAttempts: number
  /** Window duration in milliseconds */
  windowMs: number
  /** If set, block for this duration (ms) after exceeding max attempts */
  blockDurationMs?: number
  /** If true, only check if blocked without incrementing the counter */
  checkOnly?: boolean
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

/**
 * Database-backed rate limiter using Postgres.
 * Works across multiple serverless instances (Vercel).
 *
 * Uses atomic SQL upsert to handle concurrent requests safely (no TOCTOU race).
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const now = new Date()
  const windowStart = new Date(now.getTime() - config.windowMs)

  try {
    // Fetch existing entry
    const entry = await prisma.rateLimit.findUnique({ where: { key } })

    // Check if currently blocked
    if (entry?.blockedUntil && entry.blockedUntil > now) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.blockedUntil.getTime(),
      }
    }

    // If check-only mode, just report status without incrementing
    if (config.checkOnly) {
      if (!entry || entry.windowStart < windowStart) {
        return {
          allowed: true,
          remaining: config.maxAttempts,
          resetAt: now.getTime() + config.windowMs,
        }
      }
      const remaining = Math.max(0, config.maxAttempts - entry.count)
      return {
        allowed: entry.count < config.maxAttempts,
        remaining,
        resetAt: entry.windowStart.getTime() + config.windowMs,
      }
    }

    // Atomic upsert: handles both new/expired windows and concurrent increments
    // in a single SQL statement to prevent TOCTOU race conditions
    const result = await prisma.$queryRaw<Array<{ count: number; window_start: Date }>>`
      INSERT INTO "RateLimit" ("key", "count", "windowStart", "blockedUntil")
      VALUES (${key}, 1, ${now}, NULL)
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "RateLimit"."windowStart" < ${windowStart} THEN 1
          ELSE "RateLimit"."count" + 1
        END,
        "windowStart" = CASE
          WHEN "RateLimit"."windowStart" < ${windowStart} THEN ${now}
          ELSE "RateLimit"."windowStart"
        END,
        "blockedUntil" = CASE
          WHEN "RateLimit"."windowStart" < ${windowStart} THEN NULL
          ELSE "RateLimit"."blockedUntil"
        END
      RETURNING "count", "windowStart" as window_start
    `
    const newCount = result[0]?.count ?? 1
    const effectiveWindowStart = result[0]?.window_start ?? now

    if (newCount > config.maxAttempts) {
      // Exceeded limit — set block if configured
      const blockedUntil = config.blockDurationMs
        ? new Date(now.getTime() + config.blockDurationMs)
        : null

      if (blockedUntil) {
        await prisma.rateLimit.update({
          where: { key },
          data: { blockedUntil },
        })
      }

      return {
        allowed: false,
        remaining: 0,
        resetAt: blockedUntil
          ? blockedUntil.getTime()
          : new Date(effectiveWindowStart).getTime() + config.windowMs,
      }
    }

    return {
      allowed: true,
      remaining: config.maxAttempts - newCount,
      resetAt: new Date(effectiveWindowStart).getTime() + config.windowMs,
    }
  } catch (err) {
    // On DB error, fail open to avoid blocking legitimate users
    // but log prominently for monitoring
    console.error('[rate-limit] DB error, failing open:', err)
    return {
      allowed: true,
      remaining: config.maxAttempts,
      resetAt: now.getTime() + config.windowMs,
    }
  }
}

/**
 * Clean up expired rate limit entries. Call periodically (e.g., from a cron job).
 */
export async function cleanupRateLimits(): Promise<number> {
  const now = new Date()
  const result = await prisma.rateLimit.deleteMany({
    where: {
      AND: [
        { windowStart: { lt: new Date(now.getTime() - 60 * 60 * 1000) } }, // 1 hour old
        { OR: [{ blockedUntil: null }, { blockedUntil: { lt: now } }] },
      ],
    },
  })
  return result.count
}
