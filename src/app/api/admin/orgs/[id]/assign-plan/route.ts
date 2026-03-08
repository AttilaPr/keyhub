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
  const body = await req.json()

  const { planId } = body // null to remove plan

  const org = await prisma.organization.findUnique({ where: { id } })
  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  if (planId !== null) {
    const plan = await prisma.plan.findUnique({ where: { id: planId } })
    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }
  }

  const oldPlanId = org.planId

  await prisma.organization.update({
    where: { id },
    data: { planId: planId ?? null },
  })

  const meta = getRequestMeta(req)
  await logAuditEvent({
    actorId: session.user.id,
    action: 'admin.plan.assigned',
    targetType: 'Organization',
    targetId: id,
    metadata: { oldPlanId, newPlanId: planId },
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  return NextResponse.json({ success: true })
}
