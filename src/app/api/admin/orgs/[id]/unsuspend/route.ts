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

  const org = await prisma.organization.findUnique({ where: { id } })
  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  if (!org.suspended) {
    return NextResponse.json({ error: 'Organization is not suspended' }, { status: 400 })
  }

  await prisma.organization.update({
    where: { id },
    data: { suspended: false },
  })

  const meta = getRequestMeta(req)
  await logAuditEvent({
    actorId: session.user.id,
    action: 'admin.org.unsuspended',
    targetType: 'Organization',
    targetId: id,
    metadata: { orgName: org.name },
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  return NextResponse.json({ success: true })
}
