import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { encryptKey, decryptKey } from '@/lib/encryption'
import { checkPlanLimit } from '@/lib/plan-limits'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50))
  const skip = (page - 1) * limit

  const where = { userId: session.user.id }

  const [keys, total] = await Promise.all([
    prisma.providerKey.findMany({
      where,
      select: {
        id: true,
        provider: true,
        label: true,
        isActive: true,
        weight: true,
        latencyEma: true,
        rotationReminderDays: true,
        lastRotatedAt: true,
        createdAt: true,
        _count: { select: { logs: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.providerKey.count({ where }),
  ])

  // Aggregate cost and last used per provider key
  const keyIds = keys.map((k) => k.id)
  const [costAggs, lastUsedAggs] = keyIds.length > 0
    ? await Promise.all([
        prisma.requestLog.groupBy({
          by: ['providerKeyId'],
          where: { providerKeyId: { in: keyIds } },
          _sum: { costUsd: true },
        }),
        prisma.requestLog.groupBy({
          by: ['providerKeyId'],
          where: { providerKeyId: { in: keyIds } },
          _max: { createdAt: true },
        }),
      ])
    : [[], []]

  const costMap = new Map(costAggs.map((a) => [a.providerKeyId, a._sum.costUsd || 0]))
  const lastUsedMap = new Map(lastUsedAggs.map((a) => [a.providerKeyId, a._max.createdAt]))

  const result = keys.map((k) => ({
    ...k,
    totalCost: costMap.get(k.id) || 0,
    lastUsedAt: lastUsedMap.get(k.id) || null,
  }))

  return NextResponse.json({ keys: result, total, page, limit })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { provider, label, apiKey, weight } = body

  if (!provider || !label || !apiKey) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (typeof label !== 'string' || label.length > 100) {
    return NextResponse.json({ error: 'Label must be 100 characters or fewer' }, { status: 400 })
  }

  const VALID_PROVIDERS = ['openai', 'anthropic', 'google', 'mistral', 'groq']
  if (!VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json(
      { error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(', ')}` },
      { status: 400 }
    )
  }

  const parsedWeight = weight ? Math.min(10, Math.max(1, parseInt(weight, 10) || 1)) : 1

  // Check plan limit for new keys
  const planCheck = await checkPlanLimit(session.user.id, 'providerKeys')
  if (!planCheck.allowed) {
    return NextResponse.json(
      {
        error: `Plan limit reached: you have ${planCheck.current}/${planCheck.limit} provider keys. Upgrade your plan to create more.`,
      },
      { status: 403 }
    )
  }

  const key = await prisma.providerKey.create({
    data: {
      userId: session.user.id,
      provider,
      label,
      encryptedKey: encryptKey(apiKey),
      lastRotatedAt: new Date(),
      weight: parsedWeight,
    },
  })

  return NextResponse.json({ id: key.id, provider, label, weight: key.weight }, { status: 201 })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  await prisma.providerKey.deleteMany({
    where: { id, userId: session.user.id },
  })

  return NextResponse.json({ success: true })
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let patchBody
  try {
    patchBody = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { id, isActive, rotationReminderDays, weight } = patchBody
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const data: Record<string, unknown> = {}
  if (typeof isActive === 'boolean') data.isActive = isActive
  if (rotationReminderDays !== undefined) {
    const parsed = rotationReminderDays === null ? null : parseInt(rotationReminderDays, 10)
    if (parsed !== null && (isNaN(parsed) || parsed < 1)) {
      return NextResponse.json({ error: 'Rotation reminder days must be at least 1' }, { status: 400 })
    }
    data.rotationReminderDays = parsed
  }
  if (weight !== undefined) {
    const parsed = parseInt(weight, 10)
    if (isNaN(parsed) || parsed < 1 || parsed > 10) {
      return NextResponse.json({ error: 'Weight must be between 1 and 10' }, { status: 400 })
    }
    data.weight = parsed
  }

  await prisma.providerKey.updateMany({
    where: { id, userId: session.user.id },
    data,
  })

  return NextResponse.json({ success: true })
}
