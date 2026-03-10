import { streamText } from 'ai'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { parseModel } from '@/lib/model-routing'
import { decryptKey } from '@/lib/encryption'
import { PROVIDERS, type ProviderName } from '@/lib/providers'
import { calculateCost } from '@/lib/cost-calculator'
import prisma from '@/lib/prisma'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const start = Date.now()
  const { model, messages, platformKeyId, temperature, maxTokens } = await req.json()

  if (!model || !messages || !platformKeyId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Verify platform key belongs to user
  const platformKey = await prisma.platformKey.findFirst({
    where: { id: platformKeyId, userId: session.user.id, isActive: true },
  })

  if (!platformKey) {
    return NextResponse.json({ error: 'Platform key not found or inactive' }, { status: 400 })
  }

  let provider: string, modelId: string
  try {
    ({ provider, modelId } = parseModel(model))
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Invalid model format' }, { status: 400 })
  }

  if (!(provider in PROVIDERS)) {
    return NextResponse.json({ error: `Unsupported provider: ${provider}` }, { status: 400 })
  }

  const providerKey = await prisma.providerKey.findFirst({
    where: { userId: session.user.id, provider, isActive: true },
  })

  if (!providerKey) {
    return NextResponse.json({ error: `No ${provider} key configured` }, { status: 400 })
  }

  const apiKey = decryptKey(providerKey.encryptedKey)
  const createProvider = PROVIDERS[provider as ProviderName]
  const providerInstance = createProvider(apiKey)

  try {
    const streamOpts: Parameters<typeof streamText>[0] = {
      model: providerInstance(modelId),
      messages: messages as any,
      onFinish: async ({ usage, text }) => {
        const promptTokens = (usage as any)?.promptTokens ?? (usage as any)?.inputTokens ?? 0
        const completionTokens = (usage as any)?.completionTokens ?? (usage as any)?.outputTokens ?? 0
        const costUsd = calculateCost(modelId, promptTokens, completionTokens)

        await prisma.requestLog.create({
          data: {
            userId: session.user.id,
            platformKeyId: platformKey.id,
            providerKeyId: providerKey.id,
            provider,
            model: modelId,
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
            costUsd,
            status: 'success',
            latencyMs: Date.now() - start,
            prompt: JSON.stringify(messages),
            response: text,
          },
        })

        await prisma.platformKey.update({
          where: { id: platformKey.id },
          data: { lastUsedAt: new Date() },
        })
      },
    }

    if (typeof temperature === 'number' && temperature >= 0 && temperature <= 2) {
      streamOpts.temperature = temperature
    }
    if (typeof maxTokens === 'number' && maxTokens > 0) {
      streamOpts.maxOutputTokens = maxTokens
    }

    const result = streamText(streamOpts)

    return result.toTextStreamResponse()
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 })
  }
}
