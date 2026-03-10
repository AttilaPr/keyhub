import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await requireSuperAdmin(req)
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50))
  const actorId = searchParams.get('actorId')
  const userId = searchParams.get('userId')
  const action = searchParams.get('action')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const where: Record<string, unknown> = {}
  if (actorId) where.actorId = actorId
  if (userId) where.userId = userId
  if (action) where.action = action
  if (from || to) {
    const createdAt: Record<string, Date> = {}
    if (from) createdAt.gte = new Date(from)
    if (to) {
      const toDate = new Date(to)
      toDate.setHours(23, 59, 59, 999)
      createdAt.lte = toDate
    }
    where.createdAt = createdAt
  }

  const [events, total] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditEvent.count({ where }),
  ])

  // Collect all unique actor and user IDs to resolve names
  const userIds = new Set<string>()
  for (const e of events) {
    if (e.actorId) userIds.add(e.actorId)
    if (e.userId) userIds.add(e.userId)
  }

  const users = await prisma.user.findMany({
    where: { id: { in: [...userIds] } },
    select: { id: true, email: true, name: true, role: true },
  })

  const userMap: Record<string, { email: string; name: string | null; role: string }> = {}
  for (const u of users) {
    userMap[u.id] = { email: u.email, name: u.name, role: u.role }
  }

  const enrichedEvents = events.map((e) => ({
    ...e,
    actor: e.actorId ? userMap[e.actorId] || null : null,
    targetUser: e.userId ? userMap[e.userId] || null : null,
  }))

  return NextResponse.json({ events: enrichedEvents, total, page, limit })
}
