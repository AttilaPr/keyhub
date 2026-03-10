import { NextResponse } from 'next/server'
import { withSuperAdmin } from '@/lib/admin'
import { ensurePricingLoaded, getModelPricing } from '@/lib/cost-calculator'

async function handleGet(_req: Request, _userId: string) {
  await ensurePricingLoaded()

  const entries = Object.entries(getModelPricing()).map(([model, prices]) => ({
    model,
    inputPer1M: prices.input,
    outputPer1M: prices.output,
  }))

  return NextResponse.json({ pricing: entries })
}

export const GET = withSuperAdmin(handleGet)
