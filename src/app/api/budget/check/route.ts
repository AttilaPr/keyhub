import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { checkUserBudget, checkKeyBudget, getPeriodEnd } from '@/lib/budget'
import { sendEmail } from '@/lib/email'
import { budgetThresholdEmail, budgetExhaustedEmail } from '@/lib/email-templates'
import { dispatchWebhook } from '@/lib/webhooks'

const ALERT_COOLDOWN_MS = 60 * 60 * 1000 // 1 hour

/**
 * POST /api/budget/check
 *
 * Checks budget thresholds for a given user and their platform keys.
 * Sends email alerts and dispatches webhooks when thresholds are crossed.
 * Designed to be called as fire-and-forget after each proxy request.
 *
 * Body: { userId: string, platformKeyId?: string }
 */
export async function POST(req: Request) {
  // Validate internal call — require INTERNAL_API_SECRET always
  const authHeader = req.headers.get('x-internal-secret')
  const internalSecret = process.env.INTERNAL_API_SECRET
  if (!internalSecret || authHeader !== internalSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { userId: string; platformKeyId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { userId, platformKeyId } = body

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      emailBudgetAlerts: true,
      monthlyBudgetUsd: true,
      budgetAlertThreshold: true,
      budgetHardCap: true,
      lastBudgetAlertSentAt: true,
    },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const now = new Date()
  const canSendAlert =
    !user.lastBudgetAlertSentAt ||
    now.getTime() - new Date(user.lastBudgetAlertSentAt).getTime() > ALERT_COOLDOWN_MS

  // Check user-level budget
  const userBudget = await checkUserBudget(userId)

  if (userBudget.limit && canSendAlert) {
    if (userBudget.exceeded) {
      // Budget exhausted
      if (user.emailBudgetAlerts) {
        const html = budgetExhaustedEmail(userBudget.used, userBudget.limit, 'monthly')
        await sendEmail(user.email, 'Budget Exhausted — KeyHub', html).catch((err) =>
          console.error('[budget-check] Failed to send exhausted email:', err)
        )
      }

      await dispatchWebhook(userId, 'budget.exhausted', {
        type: 'user',
        used: userBudget.used,
        limit: userBudget.limit,
        percent: userBudget.percent,
        reset: getPeriodEnd('monthly').toISOString(),
      }).catch(() => {})

      await prisma.user.update({
        where: { id: userId },
        data: { lastBudgetAlertSentAt: now },
      })
    } else if (userBudget.alerting) {
      // Threshold crossed
      if (user.emailBudgetAlerts) {
        const usageUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/usage`
        const html = budgetThresholdEmail(userBudget.used, userBudget.limit, 'monthly', usageUrl)
        await sendEmail(user.email, 'Budget Alert — KeyHub', html).catch((err) =>
          console.error('[budget-check] Failed to send threshold email:', err)
        )
      }

      await dispatchWebhook(userId, 'budget.threshold', {
        type: 'user',
        used: userBudget.used,
        limit: userBudget.limit,
        percent: userBudget.percent,
        reset: getPeriodEnd('monthly').toISOString(),
      }).catch(() => {})

      await prisma.user.update({
        where: { id: userId },
        data: { lastBudgetAlertSentAt: now },
      })
    }
  }

  // Check platform key budget if specified
  if (platformKeyId) {
    const keyBudget = await checkKeyBudget(platformKeyId)

    if (keyBudget.limit && keyBudget.alerting && canSendAlert) {
      const pk = await prisma.platformKey.findUnique({
        where: { id: platformKeyId },
        select: { label: true, budgetPeriod: true },
      })

      const period = pk?.budgetPeriod ?? 'monthly'

      if (keyBudget.exceeded) {
        if (user.emailBudgetAlerts) {
          const html = budgetExhaustedEmail(keyBudget.used, keyBudget.limit, period)
          await sendEmail(
            user.email,
            `Key Budget Exhausted: ${pk?.label ?? platformKeyId} — KeyHub`,
            html
          ).catch((err) =>
            console.error('[budget-check] Failed to send key exhausted email:', err)
          )
        }

        await dispatchWebhook(userId, 'budget.exhausted', {
          type: 'platform_key',
          platformKeyId,
          label: pk?.label,
          used: keyBudget.used,
          limit: keyBudget.limit,
          percent: keyBudget.percent,
          reset: getPeriodEnd(period as 'daily' | 'weekly' | 'monthly').toISOString(),
        }).catch(() => {})
      } else {
        if (user.emailBudgetAlerts) {
          const usageUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/usage`
          const html = budgetThresholdEmail(keyBudget.used, keyBudget.limit, period, usageUrl)
          await sendEmail(
            user.email,
            `Key Budget Alert: ${pk?.label ?? platformKeyId} — KeyHub`,
            html
          ).catch((err) =>
            console.error('[budget-check] Failed to send key threshold email:', err)
          )
        }

        await dispatchWebhook(userId, 'budget.threshold', {
          type: 'platform_key',
          platformKeyId,
          label: pk?.label,
          used: keyBudget.used,
          limit: keyBudget.limit,
          percent: keyBudget.percent,
          reset: getPeriodEnd(period as 'daily' | 'weekly' | 'monthly').toISOString(),
        }).catch(() => {})
      }

      // Update cooldown timestamp
      await prisma.user.update({
        where: { id: userId },
        data: { lastBudgetAlertSentAt: now },
      })
    }
  }

  return NextResponse.json({ success: true })
}
