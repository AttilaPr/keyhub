import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { calculateCost, MODEL_PRICING } from '@/lib/cost-calculator'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '1000', 10) || 1000, 100), 10000)

  const userId = session.user.id

  // Fetch the last N requests with token details
  const requests = await prisma.requestLog.findMany({
    where: { userId, status: 'success' },
    select: {
      provider: true,
      model: true,
      promptTokens: true,
      completionTokens: true,
      costUsd: true,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  if (requests.length === 0) {
    return NextResponse.json({
      totalRequests: 0,
      actualCost: 0,
      cheapestCost: 0,
      savings: 0,
      savingsPercent: 0,
      modelBreakdown: [],
    })
  }

  // Find all models we know pricing for, grouped by provider
  const providerCheapestModel: Record<string, { model: string; avgCostPer1MInput: number; avgCostPer1MOutput: number }> = {}

  // Map known models to providers
  const knownProviderModels: Record<string, { model: string; input: number; output: number }[]> = {}
  for (const [model, pricing] of Object.entries(MODEL_PRICING)) {
    // Determine provider from model name patterns
    let provider = 'unknown'
    if (model.startsWith('gpt-') || model.startsWith('o1')) provider = 'openai'
    else if (model.startsWith('claude-')) provider = 'anthropic'
    else if (model.startsWith('gemini-')) provider = 'google'
    else if (model.startsWith('mistral-') || model.startsWith('codestral-')) provider = 'mistral'

    if (!knownProviderModels[provider]) knownProviderModels[provider] = []
    knownProviderModels[provider].push({ model, ...pricing })
  }

  // For each provider, find cheapest model (by average of input + output cost)
  for (const [provider, models] of Object.entries(knownProviderModels)) {
    const cheapest = models.reduce((min, m) => {
      const avgCost = (m.input + m.output) / 2
      const minAvg = (min.input + min.output) / 2
      return avgCost < minAvg ? m : min
    })
    providerCheapestModel[provider] = {
      model: cheapest.model,
      avgCostPer1MInput: cheapest.input,
      avgCostPer1MOutput: cheapest.output,
    }
  }

  // Calculate actual vs cheapest cost per model
  const modelStats: Record<string, {
    model: string
    provider: string
    requests: number
    actualCost: number
    cheapestCost: number
    cheapestModel: string
  }> = {}

  let totalActualCost = 0
  let totalCheapestCost = 0

  for (const req of requests) {
    const key = `${req.provider}/${req.model}`
    if (!modelStats[key]) {
      const cheapest = providerCheapestModel[req.provider]
      modelStats[key] = {
        model: req.model,
        provider: req.provider,
        requests: 0,
        actualCost: 0,
        cheapestCost: 0,
        cheapestModel: cheapest?.model || req.model,
      }
    }

    modelStats[key].requests++
    modelStats[key].actualCost += req.costUsd
    totalActualCost += req.costUsd

    // Calculate hypothetical cost with cheapest model
    const cheapest = providerCheapestModel[req.provider]
    if (cheapest) {
      const cheapCost = calculateCost(cheapest.model, req.promptTokens, req.completionTokens)
      modelStats[key].cheapestCost += cheapCost
      totalCheapestCost += cheapCost
    } else {
      modelStats[key].cheapestCost += req.costUsd
      totalCheapestCost += req.costUsd
    }
  }

  const savings = totalActualCost - totalCheapestCost
  const savingsPercent = totalActualCost > 0 ? (savings / totalActualCost) * 100 : 0

  return NextResponse.json({
    totalRequests: requests.length,
    actualCost: parseFloat(totalActualCost.toFixed(6)),
    cheapestCost: parseFloat(totalCheapestCost.toFixed(6)),
    savings: parseFloat(savings.toFixed(6)),
    savingsPercent: parseFloat(savingsPercent.toFixed(1)),
    modelBreakdown: Object.values(modelStats)
      .map((m) => ({
        ...m,
        actualCost: parseFloat(m.actualCost.toFixed(6)),
        cheapestCost: parseFloat(m.cheapestCost.toFixed(6)),
        savings: parseFloat((m.actualCost - m.cheapestCost).toFixed(6)),
      }))
      .sort((a, b) => b.savings - a.savings),
  })
}
