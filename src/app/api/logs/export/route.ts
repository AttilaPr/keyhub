import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const provider = searchParams.get('provider')
  const status = searchParams.get('status')
  const model = searchParams.get('model')
  const platformKeyId = searchParams.get('platformKeyId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const search = searchParams.get('search')
  const tag = searchParams.get('tag')

  const where: any = { userId: session.user.id }
  if (provider) where.provider = provider
  if (status) where.status = status
  if (model) where.model = model
  if (platformKeyId) where.platformKeyId = platformKeyId
  if (tag) where.tag = tag
  if (from || to) {
    where.createdAt = {}
    if (from) where.createdAt.gte = new Date(from)
    if (to) {
      const toDate = new Date(to)
      toDate.setHours(23, 59, 59, 999)
      where.createdAt.lte = toDate
    }
  }
  if (search) {
    where.OR = [
      { prompt: { contains: search, mode: 'insensitive' } },
      { response: { contains: search, mode: 'insensitive' } },
    ]
  }

  const logs = await prisma.requestLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 10000,
    select: {
      provider: true,
      model: true,
      promptTokens: true,
      completionTokens: true,
      totalTokens: true,
      costUsd: true,
      status: true,
      latencyMs: true,
      tag: true,
      createdAt: true,
      platformKey: { select: { label: true, keyPrefix: true } },
    },
  })

  const headers = ['Timestamp', 'Provider', 'Model', 'Prompt Tokens', 'Completion Tokens', 'Total Tokens', 'Cost', 'Status', 'Latency', 'Tag', 'API Key']

  function escapeCsv(value: string) {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }

  const rows = logs.map((l) => [
    l.createdAt.toISOString(),
    l.provider,
    l.model,
    String(l.promptTokens),
    String(l.completionTokens),
    String(l.totalTokens),
    l.costUsd.toFixed(6),
    l.status,
    `${l.latencyMs}ms`,
    l.tag || '',
    escapeCsv(`${l.platformKey.label} (${l.platformKey.keyPrefix}...)`),
  ])

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="keyhub-logs-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  })
}
