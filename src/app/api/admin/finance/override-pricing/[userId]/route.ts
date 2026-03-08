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

  const { multiplier } = body
  if (typeof multiplier !== 'number' || multiplier <= 0 || multiplier > 10) {
    return NextResponse.json(
      { error: 'multiplier must be a number between 0 and 10' },
      { status: 400 }
    )
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const oldMultiplier = user.pricingMultiplier

  await prisma.user.update({
    where: { id: userId },
    data: { pricingMultiplier: multiplier },
  })

  const meta = getRequestMeta(req)
  await logAuditEvent({
    actorId: session.user.id,
    userId,
    action: 'admin.pricing.updated',
    targetType: 'User',
    targetId: userId,
    metadata: {
      oldMultiplier,
      newMultiplier: multiplier,
    },
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  return NextResponse.json({ success: true, multiplier })
}
