import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin'
import { logAuditEvent, getRequestMeta } from '@/lib/audit'
import prisma from '@/lib/prisma'

export async function POST(req: Request) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const key = await prisma.platformKey.findUnique({ where: { id } })
  if (!key) return NextResponse.json({ error: 'Platform key not found' }, { status: 404 })

  if (key.revokedAt) {
    return NextResponse.json({ error: 'Key is already revoked' }, { status: 400 })
  }

  await prisma.platformKey.update({
    where: { id },
    data: { isActive: false, revokedAt: new Date() },
  })

  const meta = getRequestMeta(req)
  await logAuditEvent({
    actorId: session.user.id,
    userId: key.userId,
    action: 'admin.key.revoked',
    targetType: 'PlatformKey',
    targetId: id,
    metadata: { keyPrefix: key.keyPrefix, label: key.label },
    ...meta,
  })

  return NextResponse.json({ success: true })
}
