import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orgId } = await req.json()

  // Allow clearing org context (switch to personal)
  if (!orgId || orgId === 'personal') {
    return NextResponse.json({ activeOrgId: null })
  }

  // Verify user is a member of the specified organization
  const membership = await prisma.organizationMember.findUnique({
    where: {
      orgId_userId: {
        orgId,
        userId: session.user.id,
      },
    },
    include: {
      organization: { select: { id: true, name: true, slug: true, suspended: true } },
    },
  })

  if (!membership) {
    return NextResponse.json({ error: 'Organization not found or not a member' }, { status: 404 })
  }

  if (membership.organization.suspended) {
    return NextResponse.json({ error: 'This organization is suspended' }, { status: 403 })
  }

  return NextResponse.json({
    activeOrgId: orgId,
    organization: {
      id: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
      role: membership.role,
    },
  })
}
