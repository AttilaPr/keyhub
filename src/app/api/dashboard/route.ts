import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const days = Math.min(Math.max(parseInt(searchParams.get('days') || '30', 10) || 30, 1), 365)

  const userId = session.user.id
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const rangeStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

  const [monthSpend, todayRequests, totalRequests, failedRequests, recentLogs, providerSpend, keySpend, modelSpend, modelErrors, avgLatencyAgg, tokenAgg, latestRequests] = await Promise.all([
    prisma.requestLog.aggregate({
      where: { userId, createdAt: { gte: startOfMonth } },
      _sum: { costUsd: true },
    }),
    prisma.requestLog.count({
      where: { userId, createdAt: { gte: startOfDay } },
    }),
    prisma.requestLog.count({
      where: { userId, createdAt: { gte: rangeStart } },
    }),
    prisma.requestLog.count({
      where: { userId, status: 'failed', createdAt: { gte: rangeStart } },
    }),
    prisma.requestLog.findMany({
      where: { userId, createdAt: { gte: rangeStart } },
      select: { createdAt: true, costUsd: true, status: true, latencyMs: true, totalTokens: true, promptTokens: true, completionTokens: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.requestLog.groupBy({
      by: ['provider'],
      where: { userId, createdAt: { gte: rangeStart } },
      _sum: { costUsd: true },
      _count: true,
    }),
    prisma.requestLog.groupBy({
      by: ['platformKeyId'],
      where: { userId, createdAt: { gte: rangeStart } },
      _sum: { costUsd: true, totalTokens: true },
      _count: true,
    }),
    prisma.requestLog.groupBy({
      by: ['provider', 'model'],
      where: { userId, createdAt: { gte: rangeStart } },
      _sum: { costUsd: true, totalTokens: true },
      _avg: { latencyMs: true },
      _count: true,
    }),
    prisma.requestLog.groupBy({
      by: ['provider', 'model'],
      where: { userId, status: 'failed', createdAt: { gte: rangeStart } },
      _count: true,
    }),
    prisma.requestLog.aggregate({
      where: { userId, createdAt: { gte: rangeStart } },
      _avg: { latencyMs: true },
    }),
    prisma.requestLog.aggregate({
      where: { userId, createdAt: { gte: rangeStart } },
      _sum: { totalTokens: true, promptTokens: true, completionTokens: true },
    }),
    prisma.requestLog.findMany({
      where: { userId },
      select: {
        id: true,
        provider: true,
        model: true,
        totalTokens: true,
        costUsd: true,
        status: true,
        latencyMs: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ])

  // Aggregate daily requests for chart
  const dailyData: Record<string, { date: string; requests: number; cost: number; tokens: number; promptTokens: number; completionTokens: number; totalLatency: number; latencyCount: number }> = {}
  for (const log of recentLogs) {
    const dateStr = log.createdAt.toISOString().split('T')[0]
    if (!dailyData[dateStr]) {
      dailyData[dateStr] = { date: dateStr, requests: 0, cost: 0, tokens: 0, promptTokens: 0, completionTokens: 0, totalLatency: 0, latencyCount: 0 }
    }
    dailyData[dateStr].requests++
    dailyData[dateStr].cost += log.costUsd
    dailyData[dateStr].tokens += log.totalTokens
    dailyData[dateStr].promptTokens += log.promptTokens
    dailyData[dateStr].completionTokens += log.completionTokens
    if (log.latencyMs) {
      dailyData[dateStr].totalLatency += log.latencyMs
      dailyData[dateStr].latencyCount++
    }
  }

  // Compute latency percentiles
  const latencyValues = recentLogs
    .filter((l) => l.latencyMs > 0)
    .map((l) => l.latencyMs)
    .sort((a, b) => a - b)

  function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0
    const idx = Math.ceil((p / 100) * sorted.length) - 1
    return sorted[Math.max(0, idx)]
  }

  const latencyPercentiles = {
    p50: percentile(latencyValues, 50),
    p90: percentile(latencyValues, 90),
    p95: percentile(latencyValues, 95),
    p99: percentile(latencyValues, 99),
    count: latencyValues.length,
  }

  // Resolve platform key labels for key breakdown
  const keyIds = keySpend.map((k) => k.platformKeyId)
  const platformKeys = keyIds.length > 0
    ? await prisma.platformKey.findMany({
        where: { id: { in: keyIds } },
        select: { id: true, label: true, keyPrefix: true },
      })
    : []
  const keyLabelMap = new Map(platformKeys.map((k) => [k.id, { label: k.label, keyPrefix: k.keyPrefix }]))

  // Cost forecasting: linear regression on daily costs for current month
  const monthLogs = recentLogs.filter((l) => l.createdAt >= startOfMonth)
  const monthDailyData: Record<string, number> = {}
  for (const log of monthLogs) {
    const dateStr = log.createdAt.toISOString().split('T')[0]
    monthDailyData[dateStr] = (monthDailyData[dateStr] || 0) + log.costUsd
  }

  // Also include days from the month start that might not be in recentLogs range
  // Use dailyData entries that fall within current month
  for (const [dateStr, d] of Object.entries(dailyData)) {
    if (new Date(dateStr) >= startOfMonth) {
      monthDailyData[dateStr] = d.cost
    }
  }

  let costForecast: { projected: number; confidence: number; overBudget: boolean; delta: number } | null = null

  const monthDailyEntries = Object.entries(monthDailyData).sort(([a], [b]) => a.localeCompare(b))
  if (monthDailyEntries.length >= 2) {
    // Linear regression: y = mx + b where x is day index (0-based)
    const n = monthDailyEntries.length
    const xs = monthDailyEntries.map((_, i) => i)
    const ys = monthDailyEntries.map(([, cost]) => cost)
    const sumX = xs.reduce((a, b) => a + b, 0)
    const sumY = ys.reduce((a, b) => a + b, 0)
    const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0)
    const sumXX = xs.reduce((a, x) => a + x * x, 0)
    const meanY = sumY / n

    const denom = n * sumXX - sumX * sumX
    const m = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0
    const b = meanY - m * (sumX / n)

    // Project to month end
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const daysSoFar = n
    let projected = 0
    for (let d = 0; d < daysInMonth; d++) {
      if (d < daysSoFar) {
        projected += ys[d]
      } else {
        projected += Math.max(0, m * d + b)
      }
    }

    // Compute confidence based on R-squared
    const ssTot = ys.reduce((a, y) => a + (y - meanY) ** 2, 0)
    const ssRes = ys.reduce((a, y, i) => a + (y - (m * xs[i] + b)) ** 2, 0)
    const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0
    const confidence = Math.max(0, Math.min(100, Math.round(rSquared * 100)))

    // Get monthly budget for over-budget detection
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { monthlyBudgetUsd: true },
    })
    const monthlyBudget = user?.monthlyBudgetUsd ?? null

    costForecast = {
      projected: parseFloat(projected.toFixed(6)),
      confidence,
      overBudget: monthlyBudget !== null ? projected > monthlyBudget : false,
      delta: monthlyBudget !== null ? parseFloat((projected - monthlyBudget).toFixed(6)) : 0,
    }
  }

  const successRate = totalRequests > 0
    ? ((totalRequests - failedRequests) / totalRequests * 100).toFixed(1)
    : '100.0'

  return NextResponse.json({
    monthSpend: monthSpend._sum.costUsd || 0,
    costForecast,
    todayRequests,
    totalRequests,
    successRate: parseFloat(successRate),
    avgLatency: Math.round(avgLatencyAgg._avg.latencyMs || 0),
    latencyPercentiles,
    totalTokens: tokenAgg._sum.totalTokens || 0,
    promptTokens: tokenAgg._sum.promptTokens || 0,
    completionTokens: tokenAgg._sum.completionTokens || 0,
    dailyChart: Object.values(dailyData).map(d => ({
      date: d.date,
      requests: d.requests,
      cost: d.cost,
      tokens: d.tokens,
      promptTokens: d.promptTokens,
      completionTokens: d.completionTokens,
      avgLatency: d.latencyCount > 0 ? Math.round(d.totalLatency / d.latencyCount) : 0,
    })),
    providerBreakdown: providerSpend.map((p) => ({
      provider: p.provider,
      cost: p._sum.costUsd || 0,
      requests: p._count,
    })),
    modelBreakdown: modelSpend.map((m) => {
      const errors = modelErrors.find((e) => e.provider === m.provider && e.model === m.model)
      const errorCount = errors?._count || 0
      return {
        provider: m.provider,
        model: m.model,
        cost: m._sum.costUsd || 0,
        tokens: m._sum.totalTokens || 0,
        requests: m._count,
        avgLatency: Math.round(m._avg.latencyMs || 0),
        errorRate: m._count > 0 ? parseFloat((errorCount / m._count * 100).toFixed(1)) : 0,
      }
    }).sort((a, b) => b.cost - a.cost),
    keyBreakdown: keySpend.map((k) => {
      const meta = keyLabelMap.get(k.platformKeyId)
      return {
        label: meta?.label || 'Deleted Key',
        keyPrefix: meta?.keyPrefix || '???',
        cost: k._sum.costUsd || 0,
        tokens: k._sum.totalTokens || 0,
        requests: k._count,
      }
    }).sort((a, b) => b.cost - a.cost),
    latestRequests: latestRequests.map((r) => ({
      id: r.id,
      provider: r.provider,
      model: r.model,
      totalTokens: r.totalTokens,
      costUsd: r.costUsd,
      status: r.status,
      latencyMs: r.latencyMs,
      createdAt: r.createdAt,
    })),
  })
}
