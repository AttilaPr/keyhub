import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { requireOrgRole } from '@/lib/org-permissions'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const check = await requireOrgRole(id, session.user.id, 'MEMBER')
  if (!check.allowed) return NextResponse.json({ error: check.error }, { status: 403 })

  const members = await prisma.organizationMember.findMany({
    where: { orgId: id },
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
    },
    orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
  })

  return NextResponse.json(
    members.map((m) => ({
      id: m.id,
      userId: m.user.id,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
      joinedAt: m.joinedAt,
    }))
  )
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const check = await requireOrgRole(id, session.user.id, 'ADMIN')
  if (!check.allowed) return NextResponse.json({ error: check.error }, { status: 403 })

  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })

  // Can't remove the owner
  const targetMember = await prisma.organizationMember.findUnique({
    where: { orgId_userId: { orgId: id, userId } },
  })
  if (!targetMember) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
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
