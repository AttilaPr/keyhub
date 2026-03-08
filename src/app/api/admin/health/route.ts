import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin'
import prisma from '@/lib/prisma'

type ProviderStatus = 'ok' | 'error' | 'unconfigured'

const KNOWN_PROVIDERS = ['openai', 'anthropic', 'google', 'mistral']

export async function GET() {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Check DB connection
  let dbStatus: 'ok' | 'error' = 'error'
  let dbLatencyMs = 0
  try {
    const start = Date.now()
    await prisma.$queryRaw`SELECT 1`
    dbLatencyMs = Date.now() - start
    dbStatus = 'ok'
  } catch {
    dbStatus = 'error'
  }

  // Check each AI provider: do they have active keys and recent successful requests?
  const providers: Record<string, { status: ProviderStatus; activeKeys: number; recentRequests: number; recentErrors: number }> = {}

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  for (const provider of KNOWN_PROVIDERS) {
    try {
      const [activeKeyCount, recentSuccessful, recentFailed] = await Promise.all([
        prisma.providerKey.count({
          where: { provider, isActive: true },
        }),
        prisma.requestLog.count({
          where: {
            provider,
            status: 'success',
            createdAt: { gte: oneDayAgo },
          },
        }),
        prisma.requestLog.count({
          where: {
            provider,
            status: { not: 'success' },
            createdAt: { gte: oneDayAgo },
          },
        }),
      ])

      let status: ProviderStatus
      if (activeKeyCount === 0) {
        status = 'unconfigured'
      } else if (recentSuccessful > 0) {
        status = 'ok'
      } else if (recentFailed > 0) {
        status = 'error'
      } else {
        // Active keys but no recent requests — assume ok (idle)
        status = 'ok'
      }

      providers[provider] = {
        status,
        activeKeys: activeKeyCount,
        recentRequests: recentSuccessful,
        recentErrors: recentFailed,
      }
    } catch {
      providers[provider] = {
        status: 'error',
        activeKeys: 0,
        recentRequests: 0,
        recentErrors: 0,
      }
    }
  }

  return NextResponse.json({
    db: { status: dbStatus, latencyMs: dbLatencyMs },
    providers,
    checkedAt: new Date().toISOString(),
  })
}
