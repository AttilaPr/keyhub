import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await requireSuperAdmin()
  if (!session) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()

  if (!q || q.length < 2) {
    return NextResponse.json({ users: [], organizations: [], keys: [] })
  }

  const searchTerm = `%${q}%`

  // Search users by email or name
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      suspended: true,
    },
    take: 5,
  })

  // Search organizations by name or slug
  const organizations = await prisma.organization.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      name: true,
      slug: true,
      suspended: true,
    },
    take: 5,
  })

  // Search platform keys by prefix or label
  const keys = await prisma.platformKey.findMany({
    where: {
      OR: [
        { keyPrefix: { contains: q, mode: 'insensitive' } },
        { label: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      label: true,
      keyPrefix: true,
      isActive: true,
      userId: true,
      user: {
        select: { email: true },
      },
    },
    take: 5,
  })

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      suspended: u.suspended,
    })),
    organizations: organizations.map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      suspended: o.suspended,
    })),
    keys: keys.map((k) => ({
      id: k.id,
      label: k.label,
      keyPrefix: k.keyPrefix,
      isActive: k.isActive,
      ownerEmail: k.user.email,
    })),
  })
}
