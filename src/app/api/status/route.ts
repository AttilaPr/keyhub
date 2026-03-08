import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000) // last 24h

  // Get all logs from the last 24h for this user
  const logs = await prisma.requestLog.findMany({
    where: {
      userId: session.user.id,
      createdAt: { gte: since },
    },
    select: {
      provider: true,
      status: true,
      latencyMs: true,
      errorMessage: true,
      createdAt: true,
    },
  })

  // Group by provider
  const providerMap = new Map<string, {
    total: number
    success: number
    totalLatency: number
    lastErrorAt: Date | null
  }>()

  for (const log of logs) {
    const entry = providerMap.get(log.provider) ?? {
      total: 0,
      success: 0,
      totalLatency: 0,
      lastErrorAt: null,
    }
    entry.total++
    if (log.status === 'success') {
      entry.success++
    } else {
      if (!entry.lastErrorAt || log.createdAt > entry.lastErrorAt) {
        entry.lastErrorAt = log.createdAt
      }
    }
    entry.totalLatency += log.latencyMs
    providerMap.set(log.provider, entry)
  }

  const providers = Array.from(providerMap.entries()).map(([provider, data]) => ({
    provider,
    successRate: data.total > 0 ? Math.round((data.success / data.total) * 10000) / 100 : 100,
    avgLatency: data.total > 0 ? Math.round(data.totalLatency / data.total) : 0,
    requestCount: data.total,
    lastErrorAt: data.lastErrorAt?.toISOString() ?? null,
  }))

  // Sort by request count descending
  providers.sort((a, b) => b.requestCount - a.requestCount)

  return NextResponse.json({
    providers,
    periodStart: since.toISOString(),
    periodEnd: new Date().toISOString(),
  })
}
