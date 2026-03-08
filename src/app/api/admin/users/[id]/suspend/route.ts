import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin'
import prisma from '@/lib/prisma'
import { logAuditEvent, getRequestMeta } from '@/lib/audit'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { id } = await params
  const { reason } = await req.json()

  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    return NextResponse.json({ error: 'Suspension reason is required' }, { status: 400 })
  }

  // Don't allow suspending yourself
  if (id === session.user.id) {
    return NextResponse.json({ error: 'Cannot suspend your own account' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (user.suspended) {
    return NextResponse.json({ error: 'User is already suspended' }, { status: 400 })
  }

  await prisma.user.update({
    where: { id },
    data: {
      suspended: true,
      suspendedAt: new Date(),
      suspendReason: reason.trim(),
    },
  })

  const meta = getRequestMeta(req)
  await logAuditEvent({
    actorId: session.user.id,
    userId: id,
    action: 'admin.user.suspended',
    targetType: 'User',
    targetId: id,
    metadata: { reason: reason.trim() },
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  return NextResponse.json({ success: true })
}
