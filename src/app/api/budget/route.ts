import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { checkUserBudget } from '@/lib/budget'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { monthlyBudgetUsd: true, budgetAlertThreshold: true, budgetHardCap: true },
  })

  const budget = await checkUserBudget(session.user.id)

  return NextResponse.json({
    monthlyBudgetUsd: user?.monthlyBudgetUsd ?? null,
    budgetAlertThreshold: user?.budgetAlertThreshold ?? 0.8,
    budgetHardCap: user?.budgetHardCap ?? false,
    used: budget.used,
    percent: budget.percent,
    exceeded: budget.exceeded,
    alerting: budget.alerting,
  })
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { monthlyBudgetUsd, budgetAlertThreshold, budgetHardCap } = await req.json()

  const data: Record<string, unknown> = {}

  if (monthlyBudgetUsd !== undefined) {
    const parsed = monthlyBudgetUsd === null ? null : parseFloat(monthlyBudgetUsd)
    if (parsed !== null && (isNaN(parsed) || parsed < 0)) {
      return NextResponse.json({ error: 'Budget must be a positive number' }, { status: 400 })
    }
    data.monthlyBudgetUsd = parsed
  }

  if (budgetAlertThreshold !== undefined) {
    const parsed = parseFloat(budgetAlertThreshold)
    if (isNaN(parsed) || parsed < 0 || parsed > 1) {
      return NextResponse.json({ error: 'Alert threshold must be between 0 and 1' }, { status: 400 })
    }
    data.budgetAlertThreshold = parsed
  }

  if (typeof budgetHardCap === 'boolean') {
    data.budgetHardCap = budgetHardCap
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data,
  })

  return NextResponse.json({ success: true })
}
