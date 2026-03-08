import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin'
import prisma from '@/lib/prisma'
import { logAuditEvent, getRequestMeta } from '@/lib/audit'

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { id: orgId, userId } = await params

  const membership = await prisma.organizationMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
  })

  if (!membership) {
    return NextResponse.json({ error: 'Member not found in organization' }, { status: 404 })
  }

  await prisma.organizationMember.delete({
    where: { orgId_userId: { orgId, userId } },
  })

  const meta = getRequestMeta(req)
  await logAuditEvent({
    actorId: session.user.id,
    userId,
    action: 'admin.org.member_removed',
    targetType: 'OrganizationMember',
    targetId: membership.id,
    metadata: { orgId, userId, role: membership.role },
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  return NextResponse.json({ success: true })
}
