import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { generateSlug } from '@/lib/org-permissions'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const memberships = await prisma.organizationMember.findMany({
    where: { userId: session.user.id },
    include: {
      organization: {
        include: {
          _count: { select: { members: true } },
        },
      },
    },
    orderBy: { joinedAt: 'desc' },
  })

  const orgs = memberships.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
    slug: m.organization.slug,
    role: m.role,
    memberCount: m.organization._count.members,
    joinedAt: m.joinedAt,
    createdAt: m.organization.createdAt,
  }))

  return NextResponse.json(orgs)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name } = await req.json()
  const trimmedName = typeof name === 'string' ? name.trim() : ''
  if (!trimmedName) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  if (trimmedName.length > 100) return NextResponse.json({ error: 'Name must be 100 characters or less' }, { status: 400 })

  let slug = generateSlug(trimmedName)
  if (!slug) slug = 'org'

  // Ensure slug uniqueness by appending a random suffix if needed
  const existing = await prisma.organization.findUnique({ where: { slug } })
  if (existing) {
    slug = `${slug}-${Math.random().toString(36).slice(2, 8)}`
  }

  const org = await prisma.organization.create({
    data: {
      name: trimmedName,
      slug,
      members: {
        create: {
          userId: session.user.id,
          role: 'OWNER',
        },
      },
    },
    include: {
      _count: { select: { members: true } },
    },
  })

  return NextResponse.json({
    id: org.id,
    name: org.name,
    slug: org.slug,
    role: 'OWNER',
    memberCount: org._count.members,
    createdAt: org.createdAt,
  }, { status: 201 })
}
