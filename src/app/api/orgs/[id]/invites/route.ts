import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { requireOrgRole } from '@/lib/org-permissions'
import { OrgRole } from '@prisma/client'
import { sendEmail } from '@/lib/email'
import { orgInviteEmail } from '@/lib/email-templates'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const check = await requireOrgRole(id, session.user.id, 'ADMIN')
  if (!check.allowed) return NextResponse.json({ error: check.error }, { status: 403 })

  const invites = await prisma.organizationInvite.findMany({
    where: { orgId: id, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: 'asc' },
  })

  return NextResponse.json(
    invites.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      token: inv.token,
      expiresAt: inv.expiresAt,
    }))
  )
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const check = await requireOrgRole(id, session.user.id, 'ADMIN')
  if (!check.allowed) return NextResponse.json({ error: check.error }, { status: 403 })

  const { email, role } = await req.json()

  const trimmedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (!trimmedEmail || !trimmedEmail.includes('@')) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
  }

  const inviteRole: OrgRole = role && ['ADMIN', 'MEMBER'].includes(role) ? role : 'MEMBER'

  // Check if user is already a member
  const existingUser = await prisma.user.findUnique({ where: { email: trimmedEmail } })
  if (existingUser) {
    const existingMember = await prisma.organizationMember.findUnique({
      where: { orgId_userId: { orgId: id, userId: existingUser.id } },
    })
    if (existingMember) {
      return NextResponse.json({ error: 'User is already a member of this organization' }, { status: 409 })
    }
  }

  // Check for existing pending invite
  const existingInvite = await prisma.organizationInvite.findFirst({
    where: { orgId: id, email: trimmedEmail, usedAt: null, expiresAt: { gt: new Date() } },
  })
  if (existingInvite) {
    return NextResponse.json({ error: 'A pending invite already exists for this email' }, { status: 409 })
  }

  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  const org = await prisma.organization.findUnique({ where: { id } })

  const invite = await prisma.organizationInvite.create({
    data: {
      orgId: id,
      email: trimmedEmail,
      token,
      role: inviteRole,
      expiresAt,
    },
  })

  // Send invite email (non-blocking — don't fail the request if email fails)
  const acceptUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/invites/${token}`
  sendEmail(
    trimmedEmail,
    `You're invited to ${org?.name ?? 'an organization'} on KeyHub`,
    orgInviteEmail(
      org?.name ?? 'an organization',
      session.user.name || session.user.email || 'A team member',
      acceptUrl,
      expiresAt.toLocaleDateString(),
    ),
  ).catch((err) => {
    console.error('[invite] Failed to send invite email:', err)
  })

  return NextResponse.json({
    id: invite.id,
    email: invite.email,
    role: invite.role,
    token: invite.token,
    expiresAt: invite.expiresAt,
  }, { status: 201 })
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

  const { inviteId } = await req.json()
  if (!inviteId) return NextResponse.json({ error: 'inviteId is required' }, { status: 400 })

  await prisma.organizationInvite.deleteMany({
    where: { id: inviteId, orgId: id },
  })

  return NextResponse.json({ success: true })
}
