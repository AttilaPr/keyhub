import { NextResponse } from 'next/server'
import { withSuperAdmin } from '@/lib/admin'
import { MODEL_PRICING } from '@/lib/cost-calculator'

async function handleGet(_req: Request, _userId: string) {
  // Return the current pricing table as an array of entries
  const entries = Object.entries(MODEL_PRICING).map(([model, prices]) => ({
    model,
    inputPer1M: prices.input,
    outputPer1M: prices.output,
  }))

  return NextResponse.json({ pricing: entries })
}

export const GET = await withSuperAdmin(handleGet)
