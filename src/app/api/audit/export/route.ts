import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const where: Record<string, unknown> = {
    OR: [
      { actorId: session.user.id },
      { userId: session.user.id },
    ],
  }

  if (action) where.action = action
  if (from || to) {
    where.createdAt = {} as Record<string, Date>
    if (from) (where.createdAt as Record<string, Date>).gte = new Date(from)
    if (to) {
      const toDate = new Date(to)
      toDate.setHours(23, 59, 59, 999)
      ;(where.createdAt as Record<string, Date>).lte = toDate
    }
  }

  const events = await prisma.auditEvent.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 10000,
  })

  const headers = ['Timestamp', 'Actor ID', 'Action', 'Target Type', 'Target ID', 'IP', 'User Agent']

  function escapeCsv(value: string) {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }

  const rows = events.map((e) => [
    escapeCsv(e.createdAt.toISOString()),
    escapeCsv(e.actorId ?? ''),
    escapeCsv(e.action),
    escapeCsv(e.targetType || ''),
    escapeCsv(e.targetId || ''),
    escapeCsv(e.ip || ''),
    escapeCsv(e.userAgent || ''),
  ])

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="keyhub-audit-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  })
}
