import prisma from '@/lib/prisma'

const CONFIG_DEFAULTS: Record<string, any> = {
  maintenanceMode: false,
  signupsEnabled: true,
  defaultPlan: 'free',
  maxUsersTotal: 0,
  globalRateLimitRpm: 0,
  allowedEmailDomains: [],
  providerTimeoutMs: 30000,
  logRetentionDays: 90,
  semanticCacheEnabled: false,
  anomalyDetectionEnabled: true,
  customBannerMessage: '',
  // Admin notification preferences
  adminNotifyUserSignup: true,
  adminNotifyUserSuspended: true,
  adminNotifyAnomalyDetected: true,
  adminNotifyKeyLeaked: true,
  adminNotifyAdminLogin: true,
  adminNotifyMaintenanceToggled: true,
}

export async function getConfig(key: string): Promise<any> {
  const row = await prisma.systemConfig.findUnique({ where: { key } })
  if (!row) return CONFIG_DEFAULTS[key] ?? null
  try {
    return JSON.parse(row.value)
  } catch {
    return row.value
  }
}

export async function setConfig(key: string, value: any, adminId: string): Promise<void> {
  await prisma.systemConfig.upsert({
    where: { key },
    update: { value: JSON.stringify(value), updatedBy: adminId },
    create: { key, value: JSON.stringify(value), updatedBy: adminId },
  })
}

export async function getAllConfig(): Promise<Record<string, any>> {
  const rows = await prisma.systemConfig.findMany()
  const result: Record<string, any> = { ...CONFIG_DEFAULTS }
  for (const row of rows) {
    try {
      result[row.key] = JSON.parse(row.value)
    } catch {
      result[row.key] = row.value
    }
  }
  return result
}

export { CONFIG_DEFAULTS }
