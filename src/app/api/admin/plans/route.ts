import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin'
import prisma from '@/lib/prisma'
import { logAuditEvent, getRequestMeta } from '@/lib/audit'

export async function GET() {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const plans = await prisma.plan.findMany({
    orderBy: { monthlyPriceUsd: 'asc' },
    include: {
      _count: {
        select: {
          users: true,
          organizations: true,
        },
      },
    },
  })

  return NextResponse.json({ plans })
}

export async function POST(req: Request) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()

  const {
    name,
    monthlyPriceUsd = 0,
    requestsPerMonth = 0,
    platformKeysLimit = 5,
    providerKeysLimit = 4,
    teamMembersLimit = 1,
    logsRetentionDays = 30,
    apiRateLimit = 60,
  } = body

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  // Check name uniqueness
  const existing = await prisma.plan.findUnique({ where: { name: name.trim() } })
  if (existing) {
    return NextResponse.json({ error: 'A plan with this name already exists' }, { status: 400 })
  }

  const plan = await prisma.plan.create({
    data: {
      name: name.trim(),
      monthlyPriceUsd,
      requestsPerMonth,
      platformKeysLimit,
      providerKeysLimit,
      teamMembersLimit,
      logsRetentionDays,
      apiRateLimit,
    },
  })

  const meta = getRequestMeta(req)
  await logAuditEvent({
    actorId: session.user.id,
    action: 'admin.plan.created',
    targetType: 'Plan',
    targetId: plan.id,
    metadata: { name: plan.name },
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  return NextResponse.json({ plan }, { status: 201 })
}
