import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { generatePlatformKey } from '@/lib/platform-key'
import { getPeriodStart } from '@/lib/budget'
import { checkPlanLimit } from '@/lib/plan-limits'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = (session as any).activeOrgId ?? null
  const scope = orgId ? { orgId } : { userId: session.user.id, orgId: null }

  const keys = await prisma.platformKey.findMany({
    where: { ...scope },
    select: {
      id: true,
      label: true,
      keyPrefix: true,
      isActive: true,
      rateLimit: true,
      expiresAt: true,
      budgetUsd: true,
      budgetPeriod: true,
      allowedProviders: true,
      allowedModels: true,
      maxCostPerRequest: true,
      ipAllowlist: true,
      maxRetries: true,
      routingStrategy: true,
      lastUsedAt: true,
      createdAt: true,
      _count: { select: { logs: true } },
      fallbackRules: {
        select: {
          id: true,
          primaryProvider: true,
          fallbackProvider: true,
          triggerOnStatus: true,
          priority: true,
        },
        orderBy: { priority: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Calculate budget usage for keys that have a budget set
  const keysWithBudget = keys.filter((k) => k.budgetUsd !== null)
  const budgetUsageMap = new Map<string, number>()

  if (keysWithBudget.length > 0) {
    // Group keys by budget period to batch queries
    const periodGroups = new Map<string, string[]>()
    for (const k of keysWithBudget) {
      const period = k.budgetPeriod || 'monthly'
      if (!periodGroups.has(period)) periodGroups.set(period, [])
      periodGroups.get(period)!.push(k.id)
    }

    for (const [period, keyIds] of periodGroups) {
      const periodStart = getPeriodStart(period as 'daily' | 'weekly' | 'monthly')
      const aggs = await prisma.requestLog.groupBy({
        by: ['platformKeyId'],
        where: {
          platformKeyId: { in: keyIds },
          createdAt: { gte: periodStart },
        },
        _sum: { costUsd: true },
      })
      for (const agg of aggs) {
        budgetUsageMap.set(agg.platformKeyId, agg._sum.costUsd ?? 0)
      }
    }
  }

  const result = keys.map((k) => ({
    ...k,
    budgetUsed: k.budgetUsd !== null ? (budgetUsageMap.get(k.id) ?? 0) : null,
  }))

  return NextResponse.json(result)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = (session as any).activeOrgId ?? null

  // Check plan limit before creating
  const planCheck = await checkPlanLimit(session.user.id, 'platformKeys')
  if (!planCheck.allowed) {
    return NextResponse.json(
      {
        error: `Plan limit reached: you have ${planCheck.current}/${planCheck.limit} platform keys. Upgrade your plan to create more.`,
      },
      { status: 403 }
    )
  }

  const { label, rateLimit, expiresAt, allowedProviders, allowedModels, maxCostPerRequest: maxCostReq, budgetUsd: keyBudget, budgetPeriod: keyBudgetPeriod, ipAllowlist: keyIpAllowlist } = await req.json()
  const trimmedLabel = typeof label === 'string' ? label.trim() : ''
  if (!trimmedLabel) return NextResponse.json({ error: 'Label required' }, { status: 400 })

  const parsedRateLimit = rateLimit ? parseInt(rateLimit, 10) : null
  if (parsedRateLimit !== null && (isNaN(parsedRateLimit) || parsedRateLimit < 1)) {
    return NextResponse.json({ error: 'Rate limit must be at least 1 request per minute' }, { status: 400 })
  }

  if (expiresAt) {
    const parsedDate = new Date(expiresAt)
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: 'Invalid expiration date' }, { status: 400 })
    }
    const tomorrow = new Date()
    tomorrow.setHours(0, 0, 0, 0)
    tomorrow.setDate(tomorrow.getDate() + 1)
    if (parsedDate < tomorrow) {
      return NextResponse.json({ error: 'Expiration date must be in the future' }, { status: 400 })
    }
  }

  const { raw, prefix, hash } = await generatePlatformKey()

  const key = await prisma.platformKey.create({
    data: {
      userId: session.user.id,
      label: trimmedLabel,
      keyHash: hash,
      keyPrefix: prefix,
      rateLimit: parsedRateLimit,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      allowedProviders: Array.isArray(allowedProviders) ? allowedProviders : [],
      allowedModels: Array.isArray(allowedModels) ? allowedModels : [],
      maxCostPerRequest: maxCostReq ? parseFloat(maxCostReq) || null : null,
      budgetUsd: keyBudget ? parseFloat(keyBudget) || null : null,
      budgetPeriod: keyBudgetPeriod && ['daily', 'weekly', 'monthly'].includes(keyBudgetPeriod) ? keyBudgetPeriod : 'monthly',
      ipAllowlist: Array.isArray(keyIpAllowlist) ? keyIpAllowlist : [],
      orgId: orgId || undefined,
    },
  })

  // Return raw key only once
  return NextResponse.json({
    id: key.id,
    label: key.label,
    keyPrefix: key.keyPrefix,
    rawKey: raw,
  }, { status: 201 })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = (session as any).activeOrgId ?? null
  const scope = orgId ? { orgId } : { userId: session.user.id, orgId: null }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  await prisma.platformKey.deleteMany({
    where: { id, ...scope },
  })

  return NextResponse.json({ success: true })
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = (session as any).activeOrgId ?? null
  const scope = orgId ? { orgId } : { userId: session.user.id, orgId: null }

  const { id, isActive, rateLimit, label, expiresAt, allowedProviders, allowedModels, maxCostPerRequest, budgetUsd, budgetPeriod, ipAllowlist, maxRetries, routingStrategy, fallbackRules } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const data: Record<string, unknown> = {}
  if (typeof isActive === 'boolean') data.isActive = isActive
  if (rateLimit !== undefined) {
    const parsed = rateLimit ? parseInt(rateLimit, 10) : null
    if (parsed !== null && (isNaN(parsed) || parsed < 1)) {
      return NextResponse.json({ error: 'Rate limit must be at least 1 request per minute' }, { status: 400 })
    }
    data.rateLimit = parsed
  }
  if (typeof label === 'string' && label.trim()) data.label = label.trim()
  if (expiresAt !== undefined) data.expiresAt = expiresAt ? new Date(expiresAt) : null
  if (Array.isArray(allowedProviders)) data.allowedProviders = allowedProviders
  if (Array.isArray(allowedModels)) data.allowedModels = allowedModels
  if (maxCostPerRequest !== undefined) {
    const parsed = maxCostPerRequest === null ? null : parseFloat(maxCostPerRequest)
    if (parsed !== null && (isNaN(parsed) || parsed <= 0)) {
      return NextResponse.json({ error: 'Max cost per request must be positive' }, { status: 400 })
    }
    data.maxCostPerRequest = parsed
  }
  if (budgetUsd !== undefined) {
    const parsed = budgetUsd === null ? null : parseFloat(budgetUsd)
    if (parsed !== null && (isNaN(parsed) || parsed <= 0)) {
      return NextResponse.json({ error: 'Budget must be positive' }, { status: 400 })
    }
    data.budgetUsd = parsed
  }
  if (budgetPeriod !== undefined && ['daily', 'weekly', 'monthly'].includes(budgetPeriod)) {
    data.budgetPeriod = budgetPeriod
  }
  if (Array.isArray(ipAllowlist)) data.ipAllowlist = ipAllowlist
  if (routingStrategy !== undefined && ['round-robin', 'least-latency', 'random'].includes(routingStrategy)) {
    data.routingStrategy = routingStrategy
  }
  if (maxRetries !== undefined) {
    const parsed = maxRetries === null ? null : parseInt(maxRetries, 10)
    if (parsed !== null && (isNaN(parsed) || parsed < 0 || parsed > 10)) {
      return NextResponse.json({ error: 'Max retries must be between 0 and 10' }, { status: 400 })
    }
    data.maxRetries = parsed
  }

  await prisma.platformKey.updateMany({
    where: { id, ...scope },
    data,
  })

  // Handle fallback rules (replace all existing rules with new set)
  if (Array.isArray(fallbackRules)) {
    // Verify ownership first
    const key = await prisma.platformKey.findFirst({
      where: { id, ...scope },
      select: { id: true },
    })
    if (key) {
      // Delete existing rules
      await prisma.fallbackRule.deleteMany({
        where: { platformKeyId: id },
      })
      // Create new rules
      const validProviders = ['openai', 'anthropic', 'google', 'mistral']
      const validStatuses = [429, 500, 502, 503, 504]
      for (let i = 0; i < fallbackRules.length; i++) {
        const rule = fallbackRules[i]
        if (
          rule &&
          typeof rule.primaryProvider === 'string' &&
          typeof rule.fallbackProvider === 'string' &&
          validProviders.includes(rule.primaryProvider) &&
          validProviders.includes(rule.fallbackProvider) &&
          rule.primaryProvider !== rule.fallbackProvider &&
          Array.isArray(rule.triggerOnStatus) &&
          rule.triggerOnStatus.length > 0
        ) {
          const filteredStatuses = rule.triggerOnStatus.filter((s: number) => validStatuses.includes(s))
          if (filteredStatuses.length > 0) {
            await prisma.fallbackRule.create({
              data: {
                platformKeyId: id,
                primaryProvider: rule.primaryProvider,
                fallbackProvider: rule.fallbackProvider,
                triggerOnStatus: filteredStatuses,
                priority: i,
              },
            })
          }
        }
      }
    }
  }

  return NextResponse.json({ success: true })
}
