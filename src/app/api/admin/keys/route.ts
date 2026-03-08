import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin'
import { logAuditEvent, getRequestMeta } from '@/lib/audit'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'platform' // platform | provider
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)

  if (type === 'provider') {
    const [keys, total] = await Promise.all([
      prisma.providerKey.findMany({
        include: { user: { select: { email: true, name: true } } },
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
      include: {
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
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { id, type, isActive } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

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

  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { id, type, reason } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  if (!reason || !reason.trim()) return NextResponse.json({ error: 'Reason/justification is required' }, { status: 400 })

  const meta = getRequestMeta(req)

  if (type === 'provider') {
    // Delete associated request logs first, then the key
    await prisma.requestLog.deleteMany({ where: { providerKeyId: id } })
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
    // Delete associated request logs first, then the key
    await prisma.requestLog.deleteMany({ where: { platformKeyId: id } })
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

  return NextResponse.json({ success: true })
}
