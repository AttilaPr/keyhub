import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin'
import { logAuditEvent, getRequestMeta } from '@/lib/audit'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await requireSuperAdmin(req)
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'platform' // platform | provider
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))

  if (type === 'provider') {
    const [keys, total] = await Promise.all([
      prisma.providerKey.findMany({
        select: {
          id: true,
          provider: true,
          label: true,
          isActive: true,
          weight: true,
          latencyEma: true,
          rotationReminderDays: true,
          lastRotatedAt: true,
          createdAt: true,
          userId: true,
          user: { select: { email: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.providerKey.count(),
    ])
    return NextResponse.json({ keys, total, page, limit })
  }

  const [keys, total] = await Promise.all([
    prisma.platformKey.findMany({
      select: {
        id: true,
        label: true,
        keyPrefix: true,
        isActive: true,
        rateLimit: true,
        expiresAt: true,
        revokedAt: true,
        allowedProviders: true,
        allowedModels: true,
        ipAllowlist: true,
        budgetUsd: true,
        budgetPeriod: true,
        routingStrategy: true,
        lastUsedAt: true,
        createdAt: true,
        userId: true,
        user: { select: { email: true, name: true } },
        _count: { select: { logs: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.platformKey.count(),
  ])

  return NextResponse.json({ keys, total, page, limit })
}

export async function PATCH(req: Request) {
  const session = await requireSuperAdmin(req)
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { id, type, isActive } = body
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  if (typeof isActive !== 'boolean') return NextResponse.json({ error: 'isActive must be a boolean' }, { status: 400 })

  try {
    if (type === 'provider') {
      await prisma.providerKey.update({
        where: { id },
        data: { isActive },
      })
    } else {
      await prisma.platformKey.update({
        where: { id },
        data: { isActive },
      })
    }
  } catch {
    return NextResponse.json({ error: 'Key not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const session = await requireSuperAdmin(req)
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let deleteBody
  try {
    deleteBody = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { id, type, reason } = deleteBody
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  if (!reason || !reason.trim()) return NextResponse.json({ error: 'Reason/justification is required' }, { status: 400 })

  const meta = getRequestMeta(req)

  try {
    if (type === 'provider') {
      await prisma.providerKey.delete({ where: { id } })
      await logAuditEvent({
        actorId: session.user.id,
        action: 'admin.key.deleted',
        targetType: 'ProviderKey',
        targetId: id,
        metadata: { reason: reason.trim(), type: 'provider' },
        ...meta,
      })
    } else {
      await prisma.platformKey.delete({ where: { id } })
      await logAuditEvent({
        actorId: session.user.id,
        action: 'admin.key.deleted',
        targetType: 'PlatformKey',
        targetId: id,
        metadata: { reason: reason.trim(), type: 'platform' },
        ...meta,
      })
    }
  } catch {
    return NextResponse.json({ error: 'Key not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
