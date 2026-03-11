import { streamText } from 'ai'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { parseModel } from '@/lib/model-routing'
import { decryptKey } from '@/lib/encryption'
import { PROVIDERS, type ProviderName, isPlatformFreeModel, getPlatformFreeModelConfig } from '@/lib/providers'
import { calculateCost } from '@/lib/cost-calculator'
import prisma from '@/lib/prisma'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = (session as any).activeOrgId ?? null
  const scope = orgId ? { orgId } : { userId: session.user.id, orgId: null }

  const start = Date.now()
  const { model, messages, platformKeyId, temperature, maxTokens } = await req.json()

  if (!model || !messages) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
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

  const fullModelName = `${provider}/${modelId}`
  const isFreeModel = isPlatformFreeModel(fullModelName)

  // Platform key is optional for free models
  let platformKey: { id: string } | null = null
  if (platformKeyId) {
    platformKey = await prisma.platformKey.findFirst({
      where: { id: platformKeyId, ...scope, isActive: true },
    })
  }

  if (!isFreeModel && !platformKey) {
    return NextResponse.json({ error: 'Platform key not found or inactive' }, { status: 400 })
  }

  let providerKey: { id: string } | null = null
  let apiKey: string
  let actualModelId = modelId

  if (isFreeModel) {
    const freeConfig = getPlatformFreeModelConfig(fullModelName)
    if (!freeConfig) {
      return NextResponse.json({ error: 'Free model is not configured on this platform' }, { status: 503 })
    }
    apiKey = freeConfig.apiKey
    actualModelId = freeConfig.actualModel
  } else {
    const pk = await prisma.providerKey.findFirst({
      where: { ...scope, provider, isActive: true },
    })

    if (!pk) {
      return NextResponse.json({ error: `No ${provider} key configured` }, { status: 400 })
    }
    providerKey = pk
    apiKey = decryptKey(pk.encryptedKey)
  }

  const createProvider = PROVIDERS[provider as ProviderName]
  const providerInstance = createProvider(apiKey)

  try {
    const streamOpts: Parameters<typeof streamText>[0] = {
      model: providerInstance(actualModelId),
      messages: messages as any,
      onFinish: async ({ usage, text }) => {
        const promptTokens = (usage as any)?.promptTokens ?? (usage as any)?.inputTokens ?? 0
        const completionTokens = (usage as any)?.completionTokens ?? (usage as any)?.outputTokens ?? 0
        const costUsd = isFreeModel ? 0 : calculateCost(modelId, promptTokens, completionTokens)

        // Skip logging for free model playground requests without a platform key
        if (!platformKey) return

        await prisma.requestLog.create({
          data: {
            userId: session.user.id,
            orgId: orgId || undefined,
            platformKeyId: platformKey.id,
            providerKeyId: providerKey?.id ?? null,
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

    // Reasoning models (o1, o3, o4, etc.) don't support temperature
    const isReasoningModel = /^o\d/.test(actualModelId)
    if (!isReasoningModel && typeof temperature === 'number' && temperature >= 0 && temperature <= 2) {
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
