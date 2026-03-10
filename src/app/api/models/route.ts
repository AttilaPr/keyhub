import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { ensurePricingLoaded, getModelsByProvider } from '@/lib/cost-calculator'
import { PROVIDER_LABELS } from '@/lib/providers'

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

  return NextResponse.json({ providers })
}
