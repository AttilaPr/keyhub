import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const url = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10)))
  const search = url.searchParams.get('search') ?? ''

  // Get all users with their request stats
  const where = search
    ? {
        OR: [
          { email: { contains: search, mode: 'insensitive' as const } },
          { name: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : {}

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        pricingMultiplier: true,
        _count: {
          select: { logs: true },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ])

  // Get cost aggregates per user
  const userIds = users.map((u) => u.id)
  const costAggregates = userIds.length > 0
    ? await prisma.requestLog.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds } },
        _sum: { costUsd: true },
      })
    : []

  const costMap = new Map(costAggregates.map((a) => [a.userId, a._sum.costUsd ?? 0]))

  const result = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    pricingMultiplier: u.pricingMultiplier,
    requestCount: u._count.logs,
    totalCost: costMap.get(u.id) ?? 0,
  }))

  // Sort by total cost descending
  result.sort((a, b) => b.totalCost - a.totalCost)

  return NextResponse.json({
    users: result,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  })
}
