import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { ensurePricingLoaded, getModelsByProvider } from '@/lib/cost-calculator'
import { PROVIDER_LABELS, PLATFORM_FREE_MODELS } from '@/lib/providers'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await ensurePricingLoaded()

  const modelsByProvider = getModelsByProvider()

  const providers = Object.entries(PROVIDER_LABELS).map(([key, label]) => ({
    key,
    label,
    models: (modelsByProvider[key] || []).map((m) => `${key}/${m}`),
  }))

  // Add platform-provided free models (available to all users)
  const freeModels = Object.entries(PLATFORM_FREE_MODELS)
    .filter(([, config]) => !!process.env[config.envKey])
    .map(([model]) => model)

  if (freeModels.length > 0) {
    const existing = providers.find((p) => p.key === 'openrouter')
    if (existing) {
      // Prepend free models to the existing openrouter group
      existing.models = [...freeModels, ...existing.models]
    } else {
      providers.unshift({
        key: 'openrouter',
        label: PROVIDER_LABELS['openrouter'] || 'KeyHub Free',
        models: freeModels,
      })
    }
  }

  return NextResponse.json({ providers })
}
