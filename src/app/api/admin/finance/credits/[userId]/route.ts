import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin'
import prisma from '@/lib/prisma'
import { logAuditEvent, getRequestMeta } from '@/lib/audit'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { userId } = await params
  const body = await req.json()

  const { amount, reason } = body
  if (typeof amount !== 'number' || amount === 0) {
    return NextResponse.json({ error: 'amount must be a non-zero number' }, { status: 400 })
  }
  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    return NextResponse.json({ error: 'reason is required' }, { status: 400 })
  }

  // Verify user exists
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const transaction = await prisma.creditTransaction.create({
    data: {
      userId,
      amount,
      reason: reason.trim(),
      adminId: session.user.id,
    },
  })

  const meta = getRequestMeta(req)
  await logAuditEvent({
    actorId: session.user.id,
    userId,
    action: 'admin.credits.adjusted',
    targetType: 'User',
    targetId: userId,
    metadata: {
      amount,
      reason: reason.trim(),
      transactionId: transaction.id,
    },
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  return NextResponse.json({ transaction })
}
