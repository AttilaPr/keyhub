import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const orgId = (session as any).activeOrgId ?? null
  const scope = orgId ? { orgId } : { userId, orgId: null }

  // Fetch user profile (excluding password hash)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      monthlyBudgetUsd: true,
      budgetAlertThreshold: true,
      budgetHardCap: true,
      totpEnabled: true,
      suspended: true,
      suspendedAt: true,
      suspendReason: true,
      emailBudgetAlerts: true,
      emailAnomalyAlerts: true,
      emailKeyRotation: true,
      emailKeyExpiry: true,
      anomalyDetectionEnabled: true,
      anomalyThresholdSigma: true,
      anomalyNotifyEmail: true,
      anomalyNotifyWebhook: true,
      createdAt: true,
    },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Fetch provider keys metadata (no secrets)
  const providerKeys = await prisma.providerKey.findMany({
    where: { ...scope },
    select: {
      id: true,
      provider: true,
      label: true,
      isActive: true,
      rotationReminderDays: true,
      lastRotatedAt: true,
      createdAt: true,
    },
  })

  // Fetch platform keys metadata (no secrets)
  const platformKeys = await prisma.platformKey.findMany({
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
      lastUsedAt: true,
      createdAt: true,
    },
  })

  // Fetch logs summary (aggregated, not full prompts/responses for size)
  const logsSummary = await prisma.requestLog.groupBy({
    by: ['provider', 'model', 'status'],
    where: { ...scope },
    _count: { id: true },
    _sum: { costUsd: true, totalTokens: true },
    _avg: { latencyMs: true },
  })

  const totalLogs = await prisma.requestLog.count({ where: { ...scope } })

  // Fetch organization memberships
  const orgMemberships = await prisma.organizationMember.findMany({
    where: { userId },
    select: {
      role: true,
      joinedAt: true,
      organization: {
        select: { id: true, name: true, slug: true },
      },
    },
  })

  // Fetch webhook endpoints (no secrets) — user-scoped (no orgId on model)
  const webhookEndpoints = await prisma.webhookEndpoint.findMany({
    where: { userId },
    select: {
      id: true,
      url: true,
      events: true,
      active: true,
      failures: true,
      createdAt: true,
    },
  })

  // Fetch prompt templates — user-scoped (no orgId on model)
  const promptTemplates = await prisma.promptTemplate.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      description: true,
      systemPrompt: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  const exportData = {
    exportedAt: new Date().toISOString(),
    profile: user,
    providerKeys,
    platformKeys,
    logsSummary: {
      totalRequests: totalLogs,
      byProviderModelStatus: logsSummary.map((g) => ({
        provider: g.provider,
        model: g.model,
        status: g.status,
        count: g._count.id,
        totalCostUsd: g._sum.costUsd ?? 0,
        totalTokens: g._sum.totalTokens ?? 0,
        avgLatencyMs: Math.round(g._avg.latencyMs ?? 0),
      })),
    },
    organizations: orgMemberships.map((m) => ({
      ...m.organization,
      role: m.role,
      joinedAt: m.joinedAt,
    })),
    webhookEndpoints,
    promptTemplates,
    settings: {
      emailBudgetAlerts: user.emailBudgetAlerts,
      emailAnomalyAlerts: user.emailAnomalyAlerts,
      emailKeyRotation: user.emailKeyRotation,
      emailKeyExpiry: user.emailKeyExpiry,
      anomalyDetectionEnabled: user.anomalyDetectionEnabled,
      anomalyThresholdSigma: user.anomalyThresholdSigma,
      anomalyNotifyEmail: user.anomalyNotifyEmail,
      anomalyNotifyWebhook: user.anomalyNotifyWebhook,
    },
  }

  const jsonStr = JSON.stringify(exportData, null, 2)

  return new Response(jsonStr, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="keyhub-data-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  })
}
