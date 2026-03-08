import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { requireOrgRole } from '@/lib/org-permissions'
import { OrgRole } from '@prisma/client'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, userId } = await params
  const check = await requireOrgRole(id, session.user.id, 'OWNER')
  if (!check.allowed) return NextResponse.json({ error: check.error }, { status: 403 })

  const { role } = await req.json()
  if (!role || !['ADMIN', 'MEMBER'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role. Must be ADMIN or MEMBER.' }, { status: 400 })
  }

  // Can't change own role (owner)
  if (userId === session.user.id) {
    return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 })
  }

  const targetMember = await prisma.organizationMember.findUnique({
    where: { orgId_userId: { orgId: id, userId } },
  })
  if (!targetMember) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  const updated = await prisma.organizationMember.update({
    where: { orgId_userId: { orgId: id, userId } },
    data: { role: role as OrgRole },
  })

  return NextResponse.json({ userId, role: updated.role })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, userId } = await params
  const check = await requireOrgRole(id, session.user.id, 'ADMIN')
  if (!check.allowed) return NextResponse.json({ error: check.error }, { status: 403 })

  // Can't remove yourself
  if (userId === session.user.id) {
    return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 })
  }

  const targetMember = await prisma.organizationMember.findUnique({
    where: { orgId_userId: { orgId: id, userId } },
  })
  if (!targetMember) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  // Can't remove the owner
  if (targetMember.role === 'OWNER') {
    return NextResponse.json({ error: 'Cannot remove the organization owner' }, { status: 403 })
  }

  // Admins can't remove other admins - only owners can
  if (targetMember.role === 'ADMIN' && check.role !== 'OWNER') {
    return NextResponse.json({ error: 'Only owners can remove admins' }, { status: 403 })
  }

  await prisma.organizationMember.delete({
    where: { orgId_userId: { orgId: id, userId } },
  })

  return NextResponse.json({ success: true })
}
