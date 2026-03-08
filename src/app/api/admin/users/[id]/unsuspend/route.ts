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

  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (!user.suspended) {
    return NextResponse.json({ error: 'User is not suspended' }, { status: 400 })
  }

  await prisma.user.update({
    where: { id },
    data: {
      suspended: false,
      suspendedAt: null,
      suspendReason: null,
    },
  })

  const meta = getRequestMeta(req)
  await logAuditEvent({
    actorId: session.user.id,
    userId: id,
    action: 'admin.user.unsuspended',
    targetType: 'User',
    targetId: id,
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  return NextResponse.json({ success: true })
}
