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

  // Use SQL-level aggregation instead of loading all logs into memory
  const [
    monthSpend,
    todayRequests,
    totalRequests,
    failedRequests,
    dailyChartRaw,
    providerSpend,
    keySpend,
    modelSpend,
    modelErrors,
    avgLatencyAgg,
    tokenAgg,
    latestRequests,
    latencyPercentileData,
    monthDailyCosts,
  ] = await Promise.all([
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
    // Daily chart aggregation in SQL instead of loading all rows
    prisma.$queryRaw<Array<{
      date: string
      requests: bigint
      cost: number
      tokens: bigint
      prompt_tokens: bigint
      completion_tokens: bigint
      avg_latency: number
    }>>`
      SELECT
        TO_CHAR("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') as date,
        COUNT(*)::bigint as requests,
        COALESCE(SUM("costUsd"), 0) as cost,
        COALESCE(SUM("totalTokens"), 0)::bigint as tokens,
        COALESCE(SUM("promptTokens"), 0)::bigint as prompt_tokens,
        COALESCE(SUM("completionTokens"), 0)::bigint as completion_tokens,
        COALESCE(AVG(NULLIF("latencyMs", 0)), 0) as avg_latency
      FROM "RequestLog"
      WHERE "userId" = ${userId} AND "createdAt" >= ${rangeStart}
      GROUP BY TO_CHAR("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD')
      ORDER BY date ASC
    `,
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
    // Compute latency percentiles in SQL
    prisma.$queryRaw<Array<{
      p50: number
      p90: number
      p95: number
      p99: number
      cnt: bigint
    }>>`
      SELECT
        COALESCE(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY "latencyMs"), 0) as p50,
        COALESCE(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY "latencyMs"), 0) as p90,
        COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "latencyMs"), 0) as p95,
        COALESCE(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY "latencyMs"), 0) as p99,
        COUNT(*)::bigint as cnt
      FROM "RequestLog"
      WHERE "userId" = ${userId}
        AND "createdAt" >= ${rangeStart}
        AND "latencyMs" > 0
    `,
    // Monthly daily costs for cost forecasting (SQL aggregation)
    prisma.$queryRaw<Array<{ date: string; cost: number }>>`
      SELECT
        TO_CHAR("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') as date,
        COALESCE(SUM("costUsd"), 0) as cost
      FROM "RequestLog"
      WHERE "userId" = ${userId} AND "createdAt" >= ${startOfMonth}
      GROUP BY TO_CHAR("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD')
      ORDER BY date ASC
    `,
  ])

  // Build daily chart from SQL results
  const dailyChart = dailyChartRaw.map((d) => ({
    date: d.date,
    requests: Number(d.requests),
    cost: Number(d.cost),
    tokens: Number(d.tokens),
    promptTokens: Number(d.prompt_tokens),
    completionTokens: Number(d.completion_tokens),
    avgLatency: Math.round(Number(d.avg_latency)),
  }))

  // Latency percentiles from SQL
  const pData = latencyPercentileData[0]
  const latencyPercentiles = {
    p50: Math.round(Number(pData?.p50 ?? 0)),
    p90: Math.round(Number(pData?.p90 ?? 0)),
    p95: Math.round(Number(pData?.p95 ?? 0)),
    p99: Math.round(Number(pData?.p99 ?? 0)),
    count: Number(pData?.cnt ?? 0),
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
  let costForecast: { projected: number; confidence: number; overBudget: boolean; delta: number } | null = null

  if (monthDailyCosts.length >= 2) {
    const n = monthDailyCosts.length
    const ys = monthDailyCosts.map((d) => Number(d.cost))
    const xs = monthDailyCosts.map((_, i) => i)
    const sumX = xs.reduce((a, b) => a + b, 0)
    const sumY = ys.reduce((a, b) => a + b, 0)
    const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0)
    const sumXX = xs.reduce((a, x) => a + x * x, 0)
    const meanY = sumY / n

    const denom = n * sumXX - sumX * sumX
    const m = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0
    const b = meanY - m * (sumX / n)

    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    let projected = 0
    for (let d = 0; d < daysInMonth; d++) {
      if (d < n) {
        projected += ys[d]
      } else {
        projected += Math.max(0, m * d + b)
      }
    }

    const ssTot = ys.reduce((a, y) => a + (y - meanY) ** 2, 0)
    const ssRes = ys.reduce((a, y, i) => a + (y - (m * xs[i] + b)) ** 2, 0)
    const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0
    const confidence = Math.max(0, Math.min(100, Math.round(rSquared * 100)))

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
    dailyChart,
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
