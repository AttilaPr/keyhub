import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { token } = await params

  try {
    const membership = await prisma.$transaction(async (tx) => {
      const invite = await tx.organizationInvite.findUnique({
        where: { token },
      })

      if (!invite) throw new Error('Invite not found')
      if (invite.usedAt) throw new Error('Invite already used')
      if (invite.expiresAt < new Date()) throw new Error('Invite expired')
      if (invite.email.toLowerCase() !== session.user.email?.toLowerCase()) throw new Error('This invite was sent to a different email address')

      const existingMember = await tx.organizationMember.findUnique({
        where: { orgId_userId: { orgId: invite.orgId, userId: session.user.id } },
      })
      if (existingMember) throw new Error('You are already a member of this organization')

      const member = await tx.organizationMember.create({
        data: {
          orgId: invite.orgId,
          userId: session.user.id,
          role: invite.role,
        },
      })

      await tx.organizationInvite.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      })

      return member
    })

    return NextResponse.json({
      orgId: membership.orgId,
      role: membership.role,
    }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to accept invite'
    const status = msg.includes('not found') ? 404
      : msg.includes('already') ? 409
      : msg.includes('expired') || msg.includes('used') ? 410
      : 400
    return NextResponse.json({ error: msg }, { status })
  }
}
