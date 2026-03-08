import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
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

  // For each org, get key counts and total spend via member user IDs
  const orgIds = orgs.map((o) => o.id)

  const membersByOrg = await prisma.organizationMember.groupBy({
    by: ['orgId'],
    where: { orgId: { in: orgIds } },
    _count: true,
  })

  // Get all member user IDs per org for spend calculation
  const orgMembers = await prisma.organizationMember.findMany({
    where: { orgId: { in: orgIds } },
    select: { orgId: true, userId: true },
  })

  const userIdsByOrg: Record<string, string[]> = {}
  for (const m of orgMembers) {
    if (!userIdsByOrg[m.orgId]) userIdsByOrg[m.orgId] = []
    userIdsByOrg[m.orgId].push(m.userId)
  }

  // Get platform key counts per org's users
  const enrichedOrgs = await Promise.all(
    orgs.map(async (org) => {
      const userIds = userIdsByOrg[org.id] || []
      const [platformKeyCount, providerKeyCount, spendResult] = await Promise.all([
        userIds.length > 0
          ? prisma.platformKey.count({ where: { userId: { in: userIds } } })
          : Promise.resolve(0),
        userIds.length > 0
          ? prisma.providerKey.count({ where: { userId: { in: userIds } } })
          : Promise.resolve(0),
        userIds.length > 0
          ? prisma.requestLog.aggregate({
              where: { userId: { in: userIds } },
              _sum: { costUsd: true },
            })
          : Promise.resolve({ _sum: { costUsd: null } }),
      ])

      return {
        ...org,
        keyCount: platformKeyCount + providerKeyCount,
        totalSpend: spendResult._sum.costUsd ?? 0,
      }
    })
  )

  return NextResponse.json({ orgs: enrichedOrgs, total, page, limit })
}
