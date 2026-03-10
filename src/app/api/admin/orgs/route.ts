import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await requireSuperAdmin(req)
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))
  const search = searchParams.get('search') || ''

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { slug: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : {}

  const [orgs, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        suspended: true,
        createdAt: true,
        _count: {
          select: { members: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.organization.count({ where }),
  ])

  // Batch enrich: get member user IDs, key counts, and spend in bulk
  const orgIds = orgs.map((o) => o.id)

  const orgMembers = await prisma.organizationMember.findMany({
    where: { orgId: { in: orgIds } },
    select: { orgId: true, userId: true },
  })

  const userIdsByOrg: Record<string, string[]> = {}
  const allUserIdSet = new Set<string>()
  for (const m of orgMembers) {
    if (!userIdsByOrg[m.orgId]) userIdsByOrg[m.orgId] = []
    userIdsByOrg[m.orgId].push(m.userId)
    allUserIdSet.add(m.userId)
  }
  const allUserIds = [...allUserIdSet]

  // Batch queries: count keys and aggregate spend grouped by userId
  const [platformKeys, providerKeys, spendByUser] = await Promise.all([
    allUserIds.length > 0
      ? prisma.platformKey.groupBy({
          by: ['userId'],
          where: { userId: { in: allUserIds } },
          _count: true,
        })
      : Promise.resolve([]),
    allUserIds.length > 0
      ? prisma.providerKey.groupBy({
          by: ['userId'],
          where: { userId: { in: allUserIds } },
          _count: true,
        })
      : Promise.resolve([]),
    allUserIds.length > 0
      ? prisma.requestLog.groupBy({
          by: ['userId'],
          where: { userId: { in: allUserIds } },
          _sum: { costUsd: true },
        })
      : Promise.resolve([]),
  ])

  // Build lookup maps by userId
  const platformKeyCountByUser = new Map(platformKeys.map((r) => [r.userId, r._count]))
  const providerKeyCountByUser = new Map(providerKeys.map((r) => [r.userId, r._count]))
  const spendByUserMap = new Map(spendByUser.map((r) => [r.userId, r._sum.costUsd ?? 0]))

  const enrichedOrgs = orgs.map((org) => {
    const userIds = userIdsByOrg[org.id] || []
    let keyCount = 0
    let totalSpend = 0
    for (const uid of userIds) {
      keyCount += (platformKeyCountByUser.get(uid) ?? 0) + (providerKeyCountByUser.get(uid) ?? 0)
      totalSpend += spendByUserMap.get(uid) ?? 0
    }
    return { ...org, keyCount, totalSpend }
  })

  return NextResponse.json({ orgs: enrichedOrgs, total, page, limit })
}
