import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin'
import prisma from '@/lib/prisma'
import { logAuditEvent, getRequestMeta } from '@/lib/audit'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { id } = await params

  const org = await prisma.organization.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      suspended: true,
      createdAt: true,
      members: {
        select: {
          id: true,
          role: true,
          joinedAt: true,
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              suspended: true,
            },
          },
        },
        orderBy: { joinedAt: 'asc' },
      },
    },
  })

  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  // Get all user IDs in the org
  const userIds = org.members.map((m) => m.user.id)

  // Get keys and spend stats
  const [providerKeys, platformKeys, spendResult, requestCount] = await Promise.all([
    userIds.length > 0
      ? prisma.providerKey.findMany({
          where: { userId: { in: userIds } },
          select: {
            id: true,
            provider: true,
            label: true,
            isActive: true,
            createdAt: true,
            user: { select: { id: true, email: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve([]),
    userIds.length > 0
      ? prisma.platformKey.findMany({
          where: { userId: { in: userIds } },
          select: {
            id: true,
            label: true,
            keyPrefix: true,
            isActive: true,
            expiresAt: true,
            createdAt: true,
            user: { select: { id: true, email: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve([]),
    userIds.length > 0
      ? prisma.requestLog.aggregate({
          where: { userId: { in: userIds } },
          _sum: { costUsd: true },
        })
      : Promise.resolve({ _sum: { costUsd: null } }),
    userIds.length > 0
      ? prisma.requestLog.count({ where: { userId: { in: userIds } } })
      : Promise.resolve(0),
  ])

  return NextResponse.json({
    org,
    providerKeys,
    platformKeys,
    stats: {
      totalSpend: spendResult._sum.costUsd ?? 0,
      requestCount,
      memberCount: org.members.length,
      providerKeyCount: providerKeys.length,
      platformKeyCount: platformKeys.length,
    },
  })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { id } = await params
  const body = await req.json()

  const org = await prisma.organization.findUnique({ where: { id } })
  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  const data: Record<string, unknown> = {}
  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim()
  if (typeof body.slug === 'string' && body.slug.trim()) {
    // Check slug uniqueness
    const existing = await prisma.organization.findUnique({ where: { slug: body.slug.trim() } })
    if (existing && existing.id !== id) {
      return NextResponse.json({ error: 'Slug already in use' }, { status: 400 })
    }
    data.slug = body.slug.trim()
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  await prisma.organization.update({ where: { id }, data })

  const meta = getRequestMeta(req)
  await logAuditEvent({
    actorId: session.user.id,
    action: 'admin.org.updated',
    targetType: 'Organization',
    targetId: id,
    metadata: data,
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  return NextResponse.json({ success: true })
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { id } = await params

  const org = await prisma.organization.findUnique({ where: { id } })
  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  // Delete org and all related data (cascade handles members and invites)
  await prisma.organization.delete({ where: { id } })

  const meta = getRequestMeta(req)
  await logAuditEvent({
    actorId: session.user.id,
    action: 'admin.org.deleted',
    targetType: 'Organization',
    targetId: id,
    metadata: { orgName: org.name, orgSlug: org.slug },
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  return NextResponse.json({ success: true })
}
