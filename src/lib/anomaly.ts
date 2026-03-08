import prisma from '@/lib/prisma'
import { dispatchWebhook } from '@/lib/webhooks'
import { sendEmail } from '@/lib/email'
import { anomalyAlertEmail } from '@/lib/email-templates'

interface AnomalyCheck {
  type: string
  severity: 'warning' | 'critical'
  description: string
  metric?: string
  threshold?: string
  actual?: string
}

function stddev(values: number[]): { mean: number; std: number } {
  if (values.length === 0) return { mean: 0, std: 0 }
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
  return { mean, std: Math.sqrt(variance) }
}

export async function detectAnomalies(userId: string): Promise<AnomalyCheck[]> {
  // Check if user has anomaly detection enabled
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      anomalyDetectionEnabled: true,
      anomalyThresholdSigma: true,
      anomalyNotifyEmail: true,
      anomalyNotifyWebhook: true,
      emailAnomalyAlerts: true,
      email: true,
    },
  })

  if (!user || !user.anomalyDetectionEnabled) {
    return []
  }

  const sigma = user.anomalyThresholdSigma

  const anomalies: AnomalyCheck[] = []
  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  // Get hourly request counts for last 7 days
  const hourlyData = await prisma.$queryRaw<{ hour: Date; count: bigint; cost: number }[]>`
    SELECT
      date_trunc('hour', "createdAt") AS hour,
      COUNT(*)::bigint AS count,
      COALESCE(SUM("costUsd"), 0)::float AS cost
    FROM "RequestLog"
    WHERE "userId" = ${userId}
      AND "createdAt" >= ${sevenDaysAgo}
    GROUP BY date_trunc('hour', "createdAt")
    ORDER BY hour
  `

  const historicalCounts = hourlyData
    .filter((d) => d.hour < oneHourAgo)
    .map((d) => Number(d.count))

  const historicalCosts = hourlyData
    .filter((d) => d.hour < oneHourAgo)
    .map((d) => d.cost)

  const currentHour = hourlyData.find(
    (d) => d.hour >= oneHourAgo
  )

  if (currentHour && historicalCounts.length >= 24) {
    const countStats = stddev(historicalCounts)
    const costStats = stddev(historicalCosts)
    const currentCount = Number(currentHour.count)
    const currentCost = currentHour.cost

    // Request volume anomaly
    if (countStats.std > 0 && currentCount > countStats.mean + sigma * countStats.std) {
      const thresholdVal = Math.round(countStats.mean + sigma * countStats.std)
      anomalies.push({
        type: 'request_volume',
        severity: 'critical',
        description: `Request volume spike: ${currentCount} requests in the last hour (avg: ${Math.round(countStats.mean)}, threshold: ${thresholdVal})`,
        metric: 'Requests per hour',
        threshold: String(thresholdVal),
        actual: String(currentCount),
      })
    }

    // Cost spike anomaly
    if (costStats.std > 0 && currentCost > costStats.mean + sigma * costStats.std) {
      const thresholdVal = (costStats.mean + sigma * costStats.std).toFixed(4)
      anomalies.push({
        type: 'cost_spike',
        severity: 'critical',
        description: `Cost spike: $${currentCost.toFixed(4)} in the last hour (avg: $${costStats.mean.toFixed(4)}, threshold: $${thresholdVal})`,
        metric: 'Cost per hour',
        threshold: `$${thresholdVal}`,
        actual: `$${currentCost.toFixed(4)}`,
      })
    }
  }

  // Error rate check (last 100 requests)
  const recentLogs = await prisma.requestLog.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { status: true },
  })

  if (recentLogs.length >= 20) {
    const errorCount = recentLogs.filter((l) => l.status !== 'success').length
    const errorRate = errorCount / recentLogs.length
    if (errorRate > 0.5) {
      anomalies.push({
        type: 'error_rate',
        severity: 'warning',
        description: `High error rate: ${(errorRate * 100).toFixed(1)}% of last ${recentLogs.length} requests failed`,
        metric: 'Error rate',
        threshold: '50%',
        actual: `${(errorRate * 100).toFixed(1)}%`,
      })
    }
  }

  // Key dominance check (single key > 90% in last hour)
  const keyDistribution = await prisma.requestLog.groupBy({
    by: ['platformKeyId'],
    where: { userId, createdAt: { gte: oneHourAgo } },
    _count: true,
  })

  const totalLastHour = keyDistribution.reduce((sum, k) => sum + k._count, 0)
  if (totalLastHour >= 10) {
    for (const entry of keyDistribution) {
      if (entry._count / totalLastHour > 0.9) {
        const pct = ((entry._count / totalLastHour) * 100).toFixed(1)
        anomalies.push({
          type: 'key_dominance',
          severity: 'warning',
          description: `Single platform key accounts for ${pct}% of requests in the last hour (${entry._count}/${totalLastHour})`,
          metric: 'Key request share',
          threshold: '90%',
          actual: `${pct}%`,
        })
      }
    }
  }

  // Persist new anomalies and dispatch notifications
  for (const anomaly of anomalies) {
    // Avoid duplicate anomalies within the last hour
    const existing = await prisma.anomalyEvent.findFirst({
      where: {
        userId,
        type: anomaly.type,
        detectedAt: { gte: oneHourAgo },
      },
    })
    if (!existing) {
      const created = await prisma.anomalyEvent.create({
        data: {
          userId,
          type: anomaly.type,
          severity: anomaly.severity,
          description: anomaly.description,
        },
      })

      // Dispatch webhook notification
      if (user.anomalyNotifyWebhook) {
        dispatchWebhook(userId, 'anomaly.detected', {
          anomalyEventId: created.id,
          type: anomaly.type,
          severity: anomaly.severity,
          description: anomaly.description,
          metric: anomaly.metric,
          threshold: anomaly.threshold,
          actual: anomaly.actual,
          detectedAt: created.detectedAt.toISOString(),
        }).catch((err) => {
          console.error('[Anomaly] Webhook dispatch failed:', err)
        })
      }

      // Send email notification
      if (user.anomalyNotifyEmail && user.emailAnomalyAlerts) {
        const logsUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:4200'}/logs`
        const html = anomalyAlertEmail(
          anomaly.type,
          anomaly.metric || anomaly.type,
          anomaly.threshold || 'N/A',
          anomaly.actual || 'N/A',
          logsUrl,
        )
        sendEmail(
          user.email,
          `[KeyHub] Anomaly Detected: ${anomaly.type}`,
          html,
        ).catch((err) => {
          console.error('[Anomaly] Email send failed:', err)
        })
      }
    }
  }

  return anomalies
}
