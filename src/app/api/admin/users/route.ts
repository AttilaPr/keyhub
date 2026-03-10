import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin'
import prisma from '@/lib/prisma'
import { logAuditEvent, getRequestMeta } from '@/lib/audit'

export async function GET(req: Request) {
  const session = await requireSuperAdmin(req)
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))
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
  const session = await requireSuperAdmin(req)
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { id, role, name, email } = body
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const data: Record<string, unknown> = {}
  if (role && ['USER', 'SUPER_ADMIN'].includes(role)) data.role = role
  if (typeof name === 'string' && name.trim()) data.name = name.trim()
  if (typeof email === 'string' && email.trim()) {
    const normalizedEmail = email.trim().toLowerCase()
    // Basic email format validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }
    // Check uniqueness
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (existing && existing.id !== id) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
    }
    data.email = normalizedEmail
  }

  await prisma.user.update({
    where: { id },
    data,
  })

  const meta = getRequestMeta(req)
  await logAuditEvent({
    actorId: session.user.id,
    userId: id,
    action: 'admin.user.updated',
    targetType: 'User',
    targetId: id,
    metadata: { changes: Object.keys(data) },
    ...meta,
  }).catch(() => {})

  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const session = await requireSuperAdmin(req)
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  // Don't allow deleting yourself
  if (id === session.user.id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
  }

  // Fetch user email before deletion for audit
  const targetUser = await prisma.user.findUnique({ where: { id }, select: { email: true } })

  await prisma.$transaction([
    prisma.requestLog.deleteMany({ where: { userId: id } }),
    prisma.usageSummary.deleteMany({ where: { userId: id } }),
    prisma.anomalyEvent.deleteMany({ where: { userId: id } }),
    prisma.promptTemplate.deleteMany({ where: { userId: id } }),
    prisma.platformKey.deleteMany({ where: { userId: id } }),
    prisma.providerKey.deleteMany({ where: { userId: id } }),
    prisma.webhookEndpoint.deleteMany({ where: { userId: id } }),
    prisma.totpBackupCode.deleteMany({ where: { userId: id } }),
    prisma.announcementDismissal.deleteMany({ where: { userId: id } }),
    prisma.organizationMember.deleteMany({ where: { userId: id } }),
    prisma.user.delete({ where: { id } }),
  ])

  const meta = getRequestMeta(req)
  await logAuditEvent({
    actorId: session.user.id,
    action: 'admin.user.deleted',
    targetType: 'User',
    targetId: id,
    metadata: { email: targetUser?.email },
    ...meta,
  }).catch(() => {})

  return NextResponse.json({ success: true })
}
