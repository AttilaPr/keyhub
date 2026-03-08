import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
  const provider = searchParams.get('provider')
  const status = searchParams.get('status')
  const userId = searchParams.get('userId')

  const where: Record<string, unknown> = {}
  if (provider) where.provider = provider
  if (status) where.status = status
  if (userId) where.userId = userId

  const [logs, total] = await Promise.all([
    prisma.requestLog.findMany({
      where,
      include: {
        user: { select: { email: true, name: true } },
        platformKey: { select: { label: true, keyPrefix: true, userId: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.requestLog.count({ where }),
  ])

  return NextResponse.json({ logs, total, page, limit })
}
