import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
  const action = searchParams.get('action')

  const where: Record<string, unknown> = {
    OR: [
      { actorId: session.user.id },
      { userId: session.user.id },
    ],
  }

  if (action) where.action = action

  const [events, total] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditEvent.count({ where }),
  ])

  return NextResponse.json({ events, total, page, limit })
}
