import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin'
import prisma from '@/lib/prisma'

export async function GET() {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const [
    totalUsers,
    newUsersLast7d,
    totalProviderKeys,
    activeProviderKeys,
    totalPlatformKeys,
    activePlatformKeys,
    totalRequests,
    todayRequests,
    monthRequests,
    monthCost,
    recentUsers,
    topSpenders,
    providerBreakdown,
    requestsPerDayRaw,
    signupsPerDayRaw,
    errorRateByProviderRaw,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.providerKey.count(),
    prisma.providerKey.count({ where: { isActive: true } }),
    prisma.platformKey.count(),
    prisma.platformKey.count({ where: { isActive: true } }),
    prisma.requestLog.count(),
    prisma.requestLog.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.requestLog.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.requestLog.aggregate({
      where: { createdAt: { gte: startOfMonth } },
      _sum: { costUsd: true },
    }),
    prisma.user.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    }),
    prisma.requestLog.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: thirtyDaysAgo } },
      _sum: { costUsd: true },
      _count: true,
      orderBy: { _sum: { costUsd: 'desc' } },
      take: 10,
    }),
    prisma.requestLog.groupBy({
      by: ['provider'],
      where: { createdAt: { gte: thirtyDaysAgo } },
      _sum: { costUsd: true },
      _count: true,
    }),
    // Requests per day (last 30 days)
    prisma.$queryRaw<{ date: string; count: bigint }[]>`
      SELECT DATE("createdAt") as date, COUNT(*)::bigint as count
      FROM "RequestLog"
      WHERE "createdAt" >= ${thirtyDaysAgo}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `,
    // Signups per day (last 30 days)
    prisma.$queryRaw<{ date: string; count: bigint }[]>`
      SELECT DATE("createdAt") as date, COUNT(*)::bigint as count
      FROM "User"
      WHERE "createdAt" >= ${thirtyDaysAgo}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `,
    // Error rate by provider (last 30 days)
    prisma.$queryRaw<{ provider: string; total: bigint; errors: bigint }[]>`
      SELECT provider,
             COUNT(*)::bigint as total,
             COUNT(*) FILTER (WHERE status != '200' AND status != 'ok')::bigint as errors
      FROM "RequestLog"
      WHERE "createdAt" >= ${thirtyDaysAgo}
      GROUP BY provider
    `,
  ])

  // Top organizations by spend (via org members' request logs)
  const topOrganizationsRaw = await prisma.$queryRaw<
    { orgId: string; name: string; cost: number; requests: bigint }[]
  >`
    SELECT o.id as "orgId", o.name,
           COALESCE(SUM(r."costUsd"), 0)::float as cost,
           COUNT(r.id)::bigint as requests
    FROM "Organization" o
    JOIN "OrganizationMember" om ON om."orgId" = o.id
    JOIN "RequestLog" r ON r."userId" = om."userId" AND r."createdAt" >= ${thirtyDaysAgo}
    GROUP BY o.id, o.name
    ORDER BY cost DESC
    LIMIT 10
  `

  // Enrich top spenders with user info
  const spenderIds = topSpenders.map((s) => s.userId)
  const spenderUsers = await prisma.user.findMany({
    where: { id: { in: spenderIds } },
    select: { id: true, email: true, name: true },
  })
  const userMap = new Map(spenderUsers.map((u) => [u.id, u]))

  // Build full 30-day date range for requests per day
  const requestsPerDayMap = new Map(
    requestsPerDayRaw.map((r) => [
      new Date(r.date).toISOString().slice(0, 10),
      Number(r.count),
    ])
  )
  const requestsPerDay: { date: string; count: number }[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    const key = d.toISOString().slice(0, 10)
    requestsPerDay.push({ date: key, count: requestsPerDayMap.get(key) ?? 0 })
  }

  // Build full 30-day date range for signups per day
  const signupsPerDayMap = new Map(
    signupsPerDayRaw.map((r) => [
      new Date(r.date).toISOString().slice(0, 10),
      Number(r.count),
    ])
  )
  const signupsPerDay: { date: string; count: number }[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    const key = d.toISOString().slice(0, 10)
    signupsPerDay.push({ date: key, count: signupsPerDayMap.get(key) ?? 0 })
  }

  // Error rate by provider
  const errorRateByProvider = errorRateByProviderRaw.map((r) => {
    const total = Number(r.total)
    const errors = Number(r.errors)
    return {
      provider: r.provider,
      errorRate: total > 0 ? Math.round((errors / total) * 10000) / 100 : 0,
    }
  })

  return NextResponse.json({
    totalUsers,
    newUsersLast7d,
    totalProviderKeys,
    activeProviderKeys,
    totalPlatformKeys,
    activePlatformKeys,
    totalRequests,
    todayRequests,
    monthRequests,
    monthCost: monthCost._sum.costUsd ?? 0,
    recentUsers,
    topSpenders: topSpenders.map((s) => ({
      userId: s.userId,
      email: userMap.get(s.userId)?.email ?? 'Unknown',
      name: userMap.get(s.userId)?.name ?? null,
      requests: s._count,
      cost: s._sum.costUsd ?? 0,
    })),
    providerBreakdown: providerBreakdown.map((p) => ({
      provider: p.provider,
      requests: p._count,
      cost: p._sum.costUsd ?? 0,
    })),
    requestsPerDay,
    signupsPerDay,
    errorRateByProvider,
    topOrganizations: topOrganizationsRaw.map((o) => ({
      orgId: o.orgId,
      name: o.name,
      requests: Number(o.requests),
      cost: o.cost,
    })),
  })
}
