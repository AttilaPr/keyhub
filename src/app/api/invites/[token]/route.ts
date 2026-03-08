import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const invite = await prisma.organizationInvite.findUnique({
    where: { token },
    include: {
      organization: { select: { id: true, name: true, slug: true } },
    },
  })

  if (!invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  if (invite.usedAt) return NextResponse.json({ error: 'Invite already used' }, { status: 410 })
  if (invite.expiresAt < new Date()) return NextResponse.json({ error: 'Invite expired' }, { status: 410 })

  return NextResponse.json({
    id: invite.id,
    email: invite.email,
    role: invite.role,
    organization: invite.organization,
    expiresAt: invite.expiresAt,
  })
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { token } = await params

  const invite = await prisma.organizationInvite.findUnique({
    where: { token },
  })

  if (!invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  if (invite.usedAt) return NextResponse.json({ error: 'Invite already used' }, { status: 410 })
  if (invite.expiresAt < new Date()) return NextResponse.json({ error: 'Invite expired' }, { status: 410 })

  // Check if already a member
  const existingMember = await prisma.organizationMember.findUnique({
    where: { orgId_userId: { orgId: invite.orgId, userId: session.user.id } },
  })
  if (existingMember) {
    return NextResponse.json({ error: 'You are already a member of this organization' }, { status: 409 })
  }

  // Create membership and mark invite as used in a transaction
  const [membership] = await prisma.$transaction([
    prisma.organizationMember.create({
      data: {
        orgId: invite.orgId,
        userId: session.user.id,
        role: invite.role,
      },
    }),
    prisma.organizationInvite.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    }),
  ])

  return NextResponse.json({
    orgId: membership.orgId,
    role: membership.role,
  }, { status: 201 })
}
