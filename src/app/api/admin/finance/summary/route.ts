import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const url = new URL(req.url)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')

  const dateFilter: Record<string, Date> = {}
  if (from) dateFilter.gte = new Date(from)
  if (to) dateFilter.lte = new Date(to)

  const where = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}

  const [costResult, requestCount] = await Promise.all([
    prisma.requestLog.aggregate({
      where,
      _sum: { costUsd: true },
    }),
    prisma.requestLog.count({ where }),
  ])

  const totalRevenue = costResult._sum.costUsd ?? 0
  // Provider cost equals revenue for now (no separate provider billing integration)
  const providerCost = totalRevenue
  const margin = 0

  return NextResponse.json({
    totalRevenue,
    providerCost,
    margin,
    requestCount,
    dateRange: { from: from ?? null, to: to ?? null },
  })
}
