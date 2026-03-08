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

  const { id: orgId } = await params
  const { userId, role } = await req.json()

  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  const validRoles = ['OWNER', 'ADMIN', 'MEMBER']
  const memberRole = role && validRoles.includes(role) ? role : 'MEMBER'

  // Verify the organization exists
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true },
  })
  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  // Verify the user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Check if user is already a member
  const existing = await prisma.organizationMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
  })
  if (existing) {
    return NextResponse.json({ error: 'User is already a member of this organization' }, { status: 409 })
  }

  // Add user to org directly, bypassing invite flow
  const membership = await prisma.organizationMember.create({
    data: {
      orgId,
      userId,
      role: memberRole,
    },
  })

  const meta = getRequestMeta(req)
  await logAuditEvent({
    actorId: session.user.id,
    userId,
    action: 'admin.org.member_added',
    targetType: 'OrganizationMember',
    targetId: membership.id,
    metadata: { orgId, userId, role: memberRole, userEmail: user.email, bypassInvite: true },
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  return NextResponse.json({
    id: membership.id,
    orgId,
    userId,
    role: memberRole,
  }, { status: 201 })
}
