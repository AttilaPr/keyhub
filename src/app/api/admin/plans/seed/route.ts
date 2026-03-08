import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin'
import prisma from '@/lib/prisma'
import { logAuditEvent, getRequestMeta } from '@/lib/audit'

const DEFAULT_PLANS = [
  {
    name: 'free',
    monthlyPriceUsd: 0,
    requestsPerMonth: 1000,
    platformKeysLimit: 3,
    providerKeysLimit: 2,
    teamMembersLimit: 1,
    logsRetentionDays: 30,
    apiRateLimit: 30,
  },
  {
    name: 'pro',
    monthlyPriceUsd: 29,
    requestsPerMonth: 10000,
    platformKeysLimit: 10,
    providerKeysLimit: 4,
    teamMembersLimit: 5,
    logsRetentionDays: 90,
    apiRateLimit: 120,
  },
  {
    name: 'team',
    monthlyPriceUsd: 99,
    requestsPerMonth: 50000,
    platformKeysLimit: 25,
    providerKeysLimit: 4,
    teamMembersLimit: 20,
    logsRetentionDays: 180,
    apiRateLimit: 300,
  },
  {
    name: 'enterprise',
    monthlyPriceUsd: 499,
    requestsPerMonth: 0, // 0 = unlimited
    platformKeysLimit: 0, // 0 = unlimited
    providerKeysLimit: 0, // 0 = unlimited
    teamMembersLimit: 0, // 0 = unlimited
    logsRetentionDays: 365,
    apiRateLimit: 1000,
  },
]

export async function POST(req: Request) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let created = 0
  let skipped = 0

  for (const plan of DEFAULT_PLANS) {
    const existing = await prisma.plan.findUnique({ where: { name: plan.name } })
    if (existing) {
      skipped++
      continue
    }
    await prisma.plan.create({ data: plan })
    created++
  }

  const meta = getRequestMeta(req)
  await logAuditEvent({
    actorId: session.user.id,
    action: 'admin.plans.seeded',
    targetType: 'Plan',
    metadata: { created, skipped },
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  return NextResponse.json({ created, skipped })
}
