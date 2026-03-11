import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { resolveContext, scopeWhere } from '@/lib/api-auth'

export async function GET(req: Request) {
  const ctx = await resolveContext(req)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = ctx.userId
  const scope = scopeWhere(ctx)
  const sqlScope = ctx.orgId
    ? Prisma.sql`"orgId" = ${ctx.orgId}`
    : Prisma.sql`"userId" = ${userId} AND "orgId" IS NULL`

  const { searchParams } = new URL(req.url)
  const days = Math.min(Math.max(parseInt(searchParams.get('days') || '30', 10) || 30, 1), 365)
  const tagFilter = searchParams.get('tag')
  const rangeStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const where: any = { ...scope, createdAt: { gte: rangeStart } }
  if (tagFilter) where.tag = tagFilter

  // Fetch tag breakdown
  const tagBreakdown = await prisma.requestLog.groupBy({
    by: ['tag'],
    where: { ...scope, createdAt: { gte: rangeStart }, tag: { not: null } },
    _sum: { costUsd: true },
    _avg: { latencyMs: true },
    _count: true,
  })

  // Get all distinct tags for filter dropdown
  const distinctTags = await prisma.requestLog.findMany({
    where: { ...scope, tag: { not: null } },
    select: { tag: true },
    distinct: ['tag'],
    orderBy: { tag: 'asc' },
  })

  return NextResponse.json({
    tagBreakdown: tagBreakdown
      .map((t) => ({
        tag: t.tag || 'untagged',
        requests: t._count,
        cost: t._sum.costUsd || 0,
        avgLatency: Math.round(t._avg.latencyMs || 0),
      }))
      .sort((a, b) => b.cost - a.cost),
    tags: distinctTags.map((t) => t.tag).filter(Boolean) as string[],
  })
}
