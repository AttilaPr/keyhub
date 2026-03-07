import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')
  const provider = searchParams.get('provider')
  const status = searchParams.get('status')
  const model = searchParams.get('model')

  const where: any = { userId: session.user.id }
  if (provider) where.provider = provider
  if (status) where.status = status
  if (model) where.model = model

  const [logs, total] = await Promise.all([
    prisma.requestLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        provider: true,
        model: true,
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        costUsd: true,
        status: true,
        errorMessage: true,
        latencyMs: true,
        createdAt: true,
        prompt: true,
        response: true,
        platformKey: { select: { label: true, keyPrefix: true } },
      },
    }),
    prisma.requestLog.count({ where }),
  ])

  return NextResponse.json({ logs, total, page, limit })
}
