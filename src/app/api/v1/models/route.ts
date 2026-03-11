import { NextResponse } from 'next/server'
import { verifyPlatformKey } from '@/lib/platform-key'
import { ensurePricingLoaded, getModelsByProvider } from '@/lib/cost-calculator'
import { PLATFORM_FREE_MODELS } from '@/lib/providers'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
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

  const providerKeys = await prisma.providerKey.findMany({
    where: { userId: platformKey.userId, isActive: true },
    select: { provider: true },
  })

  await ensurePricingLoaded()
  const allModels = getModelsByProvider()

  const activeProviders = providerKeys.map((k) => k.provider)
  const models: { id: string; object: string; owned_by: string }[] = []

  // Add platform-provided free models (available to everyone)
  for (const [modelId, config] of Object.entries(PLATFORM_FREE_MODELS)) {
    if (process.env[config.envKey]) {
      models.push({
        id: modelId,
        object: 'model',
        owned_by: 'keyhub',
      })
    }
  }

  for (const provider of activeProviders) {
    const providerModels = allModels[provider] || []
    for (const modelId of providerModels) {
      models.push({
        id: `${provider}/${modelId}`,
        object: 'model',
        owned_by: provider,
      })
    }
  }

  return NextResponse.json({ object: 'list', data: models })
}
