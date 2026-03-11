import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = (session as any).activeOrgId ?? null
  const scope = orgId ? { orgId } : { userId: session.user.id, orgId: null }

  const { id } = await params

  const log = await prisma.requestLog.findFirst({
    where: { id, ...scope },
    select: {
      id: true,
      userId: true,
      provider: true,
      model: true,
      prompt: true,
      response: true,
      platformKeyId: true,
      promptTokens: true,
      completionTokens: true,
      totalTokens: true,
      costUsd: true,
      latencyMs: true,
      status: true,
      fallbackUsed: true,
      originalProvider: true,
      fallbackProvider: true,
      platformKey: {
        select: {
          id: true,
          label: true,
          keyPrefix: true,
          isActive: true,
        },
      },
    },
  })

  if (!log) {
    return NextResponse.json({ error: 'Log not found' }, { status: 404 })
  }

  // Parse the prompt (stored as JSON string of messages array)
  let messages: Array<{ role: string; content: string }> = []
  try {
    messages = JSON.parse(log.prompt)
  } catch {
    return NextResponse.json(
      { error: 'Could not parse original request messages' },
      { status: 422 }
    )
  }

  return NextResponse.json({
    id: log.id,
    provider: log.provider,
    model: log.model,
    messages,
    response: log.response,
    platformKeyId: log.platformKeyId,
    platformKey: log.platformKey,
    promptTokens: log.promptTokens,
    completionTokens: log.completionTokens,
    totalTokens: log.totalTokens,
    costUsd: log.costUsd,
    latencyMs: log.latencyMs,
    status: log.status,
    fallbackUsed: log.fallbackUsed,
    originalProvider: log.originalProvider,
    fallbackProvider: log.fallbackProvider,
  })
}
