import { streamText } from 'ai'
import { NextResponse } from 'next/server'
import { parseModel } from '@/lib/model-routing'
import { decryptKey } from '@/lib/encryption'
import { PROVIDERS, type ProviderName } from '@/lib/providers'
import { calculateCost } from '@/lib/cost-calculator'
import { verifyPlatformKey } from '@/lib/platform-key'
import prisma from '@/lib/prisma'

export async function POST(req: Request) {
  const start = Date.now()

  const authHeader = req.headers.get('Authorization')
  const rawKey = authHeader?.replace('Bearer ', '')
  if (!rawKey) {
    return NextResponse.json({ error: 'Missing API key' }, { status: 401 })
  }

  const prefix = rawKey.slice(0, 16)
  const platformKeys = await prisma.platformKey.findMany({
    where: { keyPrefix: { startsWith: prefix.slice(0, 12) }, isActive: true },
  })

  let platformKey = null
  for (const pk of platformKeys) {
    if (await verifyPlatformKey(rawKey, pk.keyHash)) {
      platformKey = pk
      break
    }
  }

  if (!platformKey) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
  }

  let body: { model: string; messages: Array<{ role: string; content: string }>; stream?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { model, messages } = body

  if (!model || !messages) {
    return NextResponse.json({ error: 'model and messages required' }, { status: 400 })
  }

  let provider: string, modelId: string
  try {
    ({ provider, modelId } = parseModel(model))
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }

  if (!(provider in PROVIDERS)) {
    return NextResponse.json({ error: `Unsupported provider: ${provider}` }, { status: 400 })
  }

  const providerKey = await prisma.providerKey.findFirst({
    where: { userId: platformKey.userId, provider, isActive: true },
  })

  if (!providerKey) {
    return NextResponse.json(
      { error: `No ${provider} key found. Add one in your dashboard.` },
      { status: 400 }
    )
  }

  const apiKey = decryptKey(providerKey.encryptedKey)
  const createProvider = PROVIDERS[provider as ProviderName]
  const providerInstance = createProvider(apiKey)

  try {
    const result = streamText({
      model: providerInstance(modelId),
      messages: messages as any,
      onFinish: async ({ usage, text }) => {
        const promptTokens = (usage as any)?.promptTokens ?? (usage as any)?.inputTokens ?? 0
        const completionTokens = (usage as any)?.completionTokens ?? (usage as any)?.outputTokens ?? 0
        const costUsd = calculateCost(modelId, promptTokens, completionTokens)

        await prisma.requestLog.create({
          data: {
            userId: platformKey.userId,
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
    })

    return result.toTextStreamResponse()
  } catch (err: any) {
    await prisma.requestLog.create({
      data: {
        userId: platformKey.userId,
        platformKeyId: platformKey.id,
        providerKeyId: providerKey.id,
        provider,
        model: modelId,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        costUsd: 0,
        status: 'failed',
        errorMessage: err.message,
        latencyMs: Date.now() - start,
        prompt: JSON.stringify(messages),
      },
    })
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
