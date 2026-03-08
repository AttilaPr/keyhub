import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
  const search = searchParams.get('search') || ''
  const sortBy = searchParams.get('sortBy') || 'createdAt'
  const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc'

  const filter = searchParams.get('filter') || ''

  const allowedSortFields = ['createdAt', 'email', 'name', 'role']
  const orderField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt'

  const searchFilter = search
    ? {
        OR: [
          { email: { contains: search, mode: 'insensitive' as const } },
          { name: { contains: search, mode: 'insensitive' as const } },
          { id: { contains: search } },
        ],
      }
    : {}

  const statusFilter = filter === 'suspended'
    ? { suspended: true }
    : filter === 'active'
      ? { suspended: false }
      : filter === 'admin'
        ? { role: 'SUPER_ADMIN' as const }
        : {}

  const where = { ...searchFilter, ...statusFilter }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        suspended: true,
        suspendedAt: true,
        suspendReason: true,
        createdAt: true,
        _count: {
          select: { logs: true, providerKeys: true, platformKeys: true },
        },
      },
      orderBy: { [orderField]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ])

  return NextResponse.json({ users, total, page, limit })
}

export async function PATCH(req: Request) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { id, role, name, email } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const data: Record<string, unknown> = {}
  if (role && ['USER', 'SUPER_ADMIN'].includes(role)) data.role = role
  if (typeof name === 'string' && name.trim()) data.name = name.trim()
  if (typeof email === 'string' && email.trim()) data.email = email.trim()

  await prisma.user.update({
    where: { id },
    data,
  })

  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  // Don't allow deleting yourself
  if (id === session.user.id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
  }

  await prisma.$transaction([
    prisma.requestLog.deleteMany({ where: { userId: id } }),
    prisma.usageSummary.deleteMany({ where: { userId: id } }),
    prisma.anomalyEvent.deleteMany({ where: { userId: id } }),
    prisma.promptTemplate.deleteMany({ where: { userId: id } }),
    prisma.platformKey.deleteMany({ where: { userId: id } }),
    prisma.providerKey.deleteMany({ where: { userId: id } }),
    prisma.webhookEndpoint.deleteMany({ where: { userId: id } }),
    prisma.user.delete({ where: { id } }),
  ])

  return NextResponse.json({ success: true })
}
