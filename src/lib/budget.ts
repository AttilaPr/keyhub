import prisma from '@/lib/prisma'

interface BudgetResult {
  used: number
  limit: number | null
  percent: number
  exceeded: boolean
  alerting: boolean
}

function getPeriodStart(period: 'daily' | 'weekly' | 'monthly'): Date {
  const now = new Date()
  if (period === 'daily') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }
  if (period === 'weekly') {
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(now.getFullYear(), now.getMonth(), diff)
  }
  // monthly
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

function getPeriodEnd(period: 'daily' | 'weekly' | 'monthly'): Date {
  const start = getPeriodStart(period)
  if (period === 'daily') {
    return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1)
  }
  if (period === 'weekly') {
    return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7)
  }
  return new Date(start.getFullYear(), start.getMonth() + 1, 1)
}

export async function checkUserBudget(userId: string): Promise<BudgetResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { monthlyBudgetUsd: true, budgetAlertThreshold: true, budgetHardCap: true },
  })

  if (!user || !user.monthlyBudgetUsd) {
    return { used: 0, limit: null, percent: 0, exceeded: false, alerting: false }
  }

  const periodStart = getPeriodStart('monthly')
  const agg = await prisma.requestLog.aggregate({
    where: { userId, createdAt: { gte: periodStart } },
    _sum: { costUsd: true },
  })

  const used = agg._sum.costUsd ?? 0
  const limit = user.monthlyBudgetUsd
  const percent = limit > 0 ? used / limit : 0

  return {
    used,
    limit,
    percent,
    exceeded: user.budgetHardCap && percent >= 1,
    alerting: percent >= user.budgetAlertThreshold,
  }
}

export async function checkKeyBudget(platformKeyId: string): Promise<BudgetResult> {
  const key = await prisma.platformKey.findUnique({
    where: { id: platformKeyId },
    select: { budgetUsd: true, budgetPeriod: true },
  })

  if (!key || !key.budgetUsd) {
    return { used: 0, limit: null, percent: 0, exceeded: false, alerting: false }
  }

  const periodStart = getPeriodStart(key.budgetPeriod)
  const agg = await prisma.requestLog.aggregate({
    where: { platformKeyId, createdAt: { gte: periodStart } },
    _sum: { costUsd: true },
  })

  const used = agg._sum.costUsd ?? 0
  const limit = key.budgetUsd
  const percent = limit > 0 ? used / limit : 0

  return {
    used,
    limit,
    percent,
    exceeded: percent >= 1,
    alerting: percent >= 0.8,
  }
}

export { getPeriodStart, getPeriodEnd }
export type { BudgetResult }
