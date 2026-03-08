import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const provider = searchParams.get('provider')
  const status = searchParams.get('status')
  const userId = searchParams.get('userId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const where: Record<string, unknown> = {}
  if (provider) where.provider = provider
  if (status) where.status = status
  if (userId) where.userId = userId
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

  const logs = await prisma.requestLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100000,
    select: {
      provider: true,
      model: true,
      promptTokens: true,
      completionTokens: true,
      totalTokens: true,
      costUsd: true,
      status: true,
      latencyMs: true,
      createdAt: true,
      userId: true,
      user: { select: { email: true, name: true } },
      platformKey: { select: { label: true, keyPrefix: true } },
    },
  })

  const headers = [
    'Timestamp',
    'User Email',
    'User Name',
    'User ID',
    'Provider',
    'Model',
    'Prompt Tokens',
    'Completion Tokens',
    'Total Tokens',
    'Cost',
    'Status',
    'Latency',
    'API Key',
  ]

  function escapeCsv(value: string) {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }

  const rows = logs.map((l) => [
    l.createdAt.toISOString(),
    escapeCsv(l.user.email),
    escapeCsv(l.user.name || ''),
    l.userId,
    l.provider,
    l.model,
    String(l.promptTokens),
    String(l.completionTokens),
    String(l.totalTokens),
    l.costUsd.toFixed(6),
    l.status,
    `${l.latencyMs}ms`,
    escapeCsv(`${l.platformKey.label} (${l.platformKey.keyPrefix}...)`),
  ])

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="keyhub-admin-logs-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  })
}
