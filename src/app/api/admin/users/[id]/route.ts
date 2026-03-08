import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin'
import prisma from '@/lib/prisma'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { id } = await params

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      suspended: true,
      suspendedAt: true,
      suspendReason: true,
      sessionInvalidatedAt: true,
      createdAt: true,
      providerKeys: {
        select: {
          id: true,
          provider: true,
          label: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      platformKeys: {
        select: {
          id: true,
          label: true,
          keyPrefix: true,
          isActive: true,
          expiresAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      orgMemberships: {
        select: {
          id: true,
          role: true,
          joinedAt: true,
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
    },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Get stats
  const [requestCount, totalCostResult, recentLogs] = await Promise.all([
    prisma.requestLog.count({ where: { userId: id } }),
    prisma.requestLog.aggregate({
      where: { userId: id },
      _sum: { costUsd: true },
    }),
    prisma.requestLog.findMany({
      where: { userId: id },
      select: {
        id: true,
        provider: true,
        model: true,
        costUsd: true,
        status: true,
        latencyMs: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ])

  return NextResponse.json({
    user,
    stats: {
      requestCount,
      totalCost: totalCostResult._sum.costUsd ?? 0,
      providerKeyCount: user.providerKeys.length,
      platformKeyCount: user.platformKeys.length,
      orgCount: user.orgMemberships.length,
    },
    recentLogs,
  })
}
