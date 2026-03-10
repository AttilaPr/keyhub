import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await requireSuperAdmin(req)
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
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

  const events = await prisma.auditEvent.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100000,
  })

  // Resolve actor/user names
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

  function escapeCsv(value: string) {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }

  const headers = [
    'Timestamp',
    'Actor ID',
    'Actor Email',
    'Actor Role',
    'Action',
    'Target Type',
    'Target ID',
    'Target User ID',
    'Target User Email',
    'Metadata',
    'IP',
    'User Agent',
  ]

  const rows = events.map((e) => {
    const actor = e.actorId ? userMap[e.actorId] : null
    const target = e.userId ? userMap[e.userId] : null
    return [
      e.createdAt.toISOString(),
      escapeCsv(e.actorId ?? ''),
      escapeCsv(actor?.email || ''),
      escapeCsv(actor?.role || ''),
      escapeCsv(e.action),
      escapeCsv(e.targetType || ''),
      escapeCsv(e.targetId || ''),
      escapeCsv(e.userId || ''),
      escapeCsv(target?.email || ''),
      escapeCsv(e.metadata || ''),
      escapeCsv(e.ip || ''),
      escapeCsv(e.userAgent || ''),
    ]
  })

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="keyhub-audit-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  })
}
