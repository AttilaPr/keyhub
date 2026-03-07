import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [monthSpend, todayRequests, totalRequests, failedRequests, recentLogs, providerSpend] = await Promise.all([
    prisma.requestLog.aggregate({
      where: { userId, createdAt: { gte: startOfMonth } },
      _sum: { costUsd: true },
    }),
    prisma.requestLog.count({
      where: { userId, createdAt: { gte: startOfDay } },
    }),
    prisma.requestLog.count({
      where: { userId, createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.requestLog.count({
      where: { userId, status: 'failed', createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.requestLog.findMany({
      where: { userId, createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, costUsd: true, status: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.requestLog.groupBy({
      by: ['provider'],
      where: { userId, createdAt: { gte: thirtyDaysAgo } },
      _sum: { costUsd: true },
      _count: true,
    }),
  ])

  // Aggregate daily requests for chart
  const dailyData: Record<string, { date: string; requests: number; cost: number }> = {}
  for (const log of recentLogs) {
    const dateStr = log.createdAt.toISOString().split('T')[0]
    if (!dailyData[dateStr]) {
      dailyData[dateStr] = { date: dateStr, requests: 0, cost: 0 }
    }
    dailyData[dateStr].requests++
    dailyData[dateStr].cost += log.costUsd
  }

  const successRate = totalRequests > 0
    ? ((totalRequests - failedRequests) / totalRequests * 100).toFixed(1)
    : '100.0'

  return NextResponse.json({
    monthSpend: monthSpend._sum.costUsd || 0,
    todayRequests,
    totalRequests,
    successRate: parseFloat(successRate),
    dailyChart: Object.values(dailyData),
    providerBreakdown: providerSpend.map((p) => ({
      provider: p.provider,
      cost: p._sum.costUsd || 0,
      requests: p._count,
    })),
  })
}
