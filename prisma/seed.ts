import { PrismaClient } from '@prisma/client'
import { createHash, randomBytes, createCipheriv } from 'crypto'

const prisma = new PrismaClient()

// Replicate encryption logic from src/lib/encryption.ts
function encryptKey(plaintext: string): string {
  const hex = process.env.KEY_ENCRYPTION_SECRET
  if (!hex || hex.length !== 64) throw new Error('KEY_ENCRYPTION_SECRET must be 64 hex chars')
  const secret = Buffer.from(hex, 'hex')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', secret, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return JSON.stringify({
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    data: encrypted.toString('hex'),
  })
}

// bcrypt-compatible hash for passwords
async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import('bcrypt')
  return bcrypt.default.hash(password, 10)
}

// Hash platform key
function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

async function main() {
  console.log('🌱 Seeding database...')

  // Clean existing data (order matters for FK constraints)
  await prisma.webhookDelivery.deleteMany()
  await prisma.webhookEndpoint.deleteMany()
  await prisma.announcementDismissal.deleteMany()
  await prisma.announcement.deleteMany()
  await prisma.creditTransaction.deleteMany()
  await prisma.auditEvent.deleteMany()
  await prisma.anomalyEvent.deleteMany()
  await prisma.requestLog.deleteMany()
  await prisma.fallbackRule.deleteMany()
  await prisma.platformKey.deleteMany()
  await prisma.providerKey.deleteMany()
  await prisma.promptTemplate.deleteMany()
  await prisma.usageSummary.deleteMany()
  await prisma.totpBackupCode.deleteMany()
  await prisma.organizationInvite.deleteMany()
  await prisma.organizationMember.deleteMany()
  await prisma.organization.deleteMany()
  await prisma.featureFlag.deleteMany()
  await prisma.systemConfig.deleteMany()
  await prisma.rateLimit.deleteMany()
  await prisma.user.deleteMany()
  await prisma.plan.deleteMany()

  // --- Plans ---
  const freePlan = await prisma.plan.create({
    data: {
      name: 'Free',
      monthlyPriceUsd: 0,
      requestsPerMonth: 1000,
      platformKeysLimit: 2,
      providerKeysLimit: 2,
      teamMembersLimit: 1,
      logsRetentionDays: 7,
      apiRateLimit: 30,
    },
  })

  const proPlan = await prisma.plan.create({
    data: {
      name: 'Pro',
      monthlyPriceUsd: 29,
      requestsPerMonth: 50000,
      platformKeysLimit: 10,
      providerKeysLimit: 10,
      teamMembersLimit: 5,
      logsRetentionDays: 90,
      apiRateLimit: 120,
    },
  })

  const enterprisePlan = await prisma.plan.create({
    data: {
      name: 'Enterprise',
      monthlyPriceUsd: 99,
      requestsPerMonth: 500000,
      platformKeysLimit: 50,
      providerKeysLimit: 50,
      teamMembersLimit: 50,
      logsRetentionDays: 365,
      apiRateLimit: 600,
    },
  })

  // --- Users ---
  const adminPassword = await hashPassword('admin123')
  const userPassword = await hashPassword('user123')

  const admin = await prisma.user.create({
    data: {
      email: 'admin@keyhub.dev',
      passwordHash: adminPassword,
      name: 'Admin User',
      role: 'SUPER_ADMIN',
      emailVerified: true,
      planId: enterprisePlan.id,
      monthlyBudgetUsd: 500,
    },
  })

  const user1 = await prisma.user.create({
    data: {
      email: 'alice@example.com',
      passwordHash: userPassword,
      name: 'Alice Developer',
      role: 'USER',
      emailVerified: true,
      planId: proPlan.id,
      monthlyBudgetUsd: 100,
    },
  })

  const user2 = await prisma.user.create({
    data: {
      email: 'bob@example.com',
      passwordHash: userPassword,
      name: 'Bob Tester',
      role: 'USER',
      emailVerified: true,
      planId: freePlan.id,
      monthlyBudgetUsd: 20,
    },
  })

  const user3 = await prisma.user.create({
    data: {
      email: 'charlie@example.com',
      passwordHash: userPassword,
      name: 'Charlie Suspended',
      role: 'USER',
      emailVerified: true,
      suspended: true,
      suspendedAt: new Date(),
      suspendReason: 'Terms of service violation',
      planId: freePlan.id,
    },
  })

  await prisma.user.create({
    data: {
      email: 'unverified@example.com',
      passwordHash: userPassword,
      name: 'Unverified User',
      role: 'USER',
      emailVerified: false,
      emailVerifyToken: 'test-verify-token-123',
      emailVerifyTokenCreatedAt: new Date(),
    },
  })

  console.log('  ✓ Users created')

  // --- Provider Keys ---
  const providerKey1 = await prisma.providerKey.create({
    data: {
      userId: user1.id,
      provider: 'openai',
      label: 'OpenAI Production',
      encryptedKey: encryptKey('sk-fake-openai-key-1234567890'),
      isActive: true,
      weight: 5,
      lastRotatedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
      rotationReminderDays: 30,
    },
  })

  const providerKey2 = await prisma.providerKey.create({
    data: {
      userId: user1.id,
      provider: 'anthropic',
      label: 'Anthropic Main',
      encryptedKey: encryptKey('sk-ant-fake-key-0987654321'),
      isActive: true,
      weight: 3,
      lastRotatedAt: new Date(),
    },
  })

  const providerKey3 = await prisma.providerKey.create({
    data: {
      userId: user2.id,
      provider: 'openai',
      label: 'Bob OpenAI',
      encryptedKey: encryptKey('sk-fake-bob-openai-key'),
      isActive: true,
      weight: 1,
      lastRotatedAt: new Date(),
    },
  })

  await prisma.providerKey.create({
    data: {
      userId: admin.id,
      provider: 'google',
      label: 'Admin Google AI',
      encryptedKey: encryptKey('fake-google-key-admin'),
      isActive: true,
      weight: 1,
      lastRotatedAt: new Date(),
    },
  })

  console.log('  ✓ Provider keys created')

  // --- Platform Keys ---
  const platformKeyRaw1 = 'kh_live_alicetestkey1234567890abcdef'
  const platformKey1 = await prisma.platformKey.create({
    data: {
      userId: user1.id,
      label: 'Alice Production Key',
      keyHash: hashKey(platformKeyRaw1),
      keyPrefix: 'kh_live_ali',
      isActive: true,
      rateLimit: 60,
      allowedProviders: ['openai', 'anthropic'],
      allowedModels: [],
      ipAllowlist: [],
      routingStrategy: 'least-latency',
      budgetUsd: 50,
      budgetPeriod: 'monthly',
    },
  })

  const platformKeyRaw2 = 'kh_live_bobtestkey0987654321fedcba'
  const platformKey2 = await prisma.platformKey.create({
    data: {
      userId: user2.id,
      label: 'Bob Dev Key',
      keyHash: hashKey(platformKeyRaw2),
      keyPrefix: 'kh_live_bob',
      isActive: true,
      rateLimit: 30,
      allowedProviders: ['openai'],
      allowedModels: ['gpt-4o-mini'],
      ipAllowlist: [],
      routingStrategy: 'round-robin',
    },
  })

  await prisma.platformKey.create({
    data: {
      userId: admin.id,
      label: 'Admin Test Key',
      keyHash: hashKey('kh_live_adminkey999888777666555'),
      keyPrefix: 'kh_live_adm',
      isActive: true,
      allowedProviders: [],
      allowedModels: [],
      ipAllowlist: [],
      routingStrategy: 'round-robin',
    },
  })

  console.log('  ✓ Platform keys created')

  // --- Request Logs (fake usage data) ---
  const models = ['gpt-4o', 'gpt-4o-mini', 'claude-sonnet-4-20250514', 'gemini-2.0-flash']
  const statuses = ['200', '200', '200', '200', '200', '429', '500']

  const logs = []
  for (let i = 0; i < 50; i++) {
    const daysAgo = Math.floor(Math.random() * 30)
    const model = models[Math.floor(Math.random() * models.length)]
    const isAlice = Math.random() > 0.3
    const userId = isAlice ? user1.id : user2.id
    const providerKeyId = isAlice ? (Math.random() > 0.5 ? providerKey1.id : providerKey2.id) : providerKey3.id
    const platformKeyId = isAlice ? platformKey1.id : platformKey2.id
    const provider = isAlice ? (providerKeyId === providerKey1.id ? 'openai' : 'anthropic') : 'openai'
    const status = statuses[Math.floor(Math.random() * statuses.length)]
    const promptTokens = Math.floor(Math.random() * 2000) + 50
    const completionTokens = Math.floor(Math.random() * 1000) + 10
    const costUsd = (promptTokens * 0.000003 + completionTokens * 0.000015)

    logs.push({
      userId,
      platformKeyId,
      providerKeyId,
      provider,
      model,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      costUsd: Math.round(costUsd * 1000000) / 1000000,
      status,
      latencyMs: Math.floor(Math.random() * 3000) + 200,
      prompt: `User asked: "${['Explain quantum computing', 'Write a haiku', 'Debug this code', 'Summarize article', 'Translate to Spanish'][Math.floor(Math.random() * 5)]}"`,
      response: status === '200' ? 'AI response content here...' : null,
      errorMessage: status !== '200' ? `Error ${status}: ${status === '429' ? 'Rate limited' : 'Internal error'}` : null,
      createdAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000 - Math.floor(Math.random() * 86400000)),
    })
  }

  await prisma.requestLog.createMany({ data: logs })
  console.log(`  ✓ ${logs.length} request logs created`)

  // --- Organizations ---
  const org1 = await prisma.organization.create({
    data: {
      name: 'Acme Corp',
      slug: 'acme-corp',
      planId: proPlan.id,
    },
  })

  const org2 = await prisma.organization.create({
    data: {
      name: 'Startup Inc',
      slug: 'startup-inc',
    },
  })

  await prisma.organizationMember.createMany({
    data: [
      { orgId: org1.id, userId: user1.id, role: 'OWNER' },
      { orgId: org1.id, userId: user2.id, role: 'MEMBER' },
      { orgId: org2.id, userId: user2.id, role: 'OWNER' },
    ],
  })

  await prisma.organizationInvite.create({
    data: {
      orgId: org1.id,
      email: 'newperson@example.com',
      token: 'invite-token-abc123',
      role: 'MEMBER',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })

  console.log('  ✓ Organizations created')

  // --- Audit Events ---
  await prisma.auditEvent.createMany({
    data: [
      { actorId: admin.id, action: 'user.login', ip: '192.168.1.1', userAgent: 'Mozilla/5.0' },
      { actorId: user1.id, action: 'user.login', ip: '10.0.0.1', userAgent: 'Chrome/120' },
      { actorId: user1.id, action: 'provider_key.created', targetType: 'ProviderKey', targetId: providerKey1.id, ip: '10.0.0.1' },
      { actorId: user1.id, action: 'platform_key.created', targetType: 'PlatformKey', targetId: platformKey1.id, ip: '10.0.0.1' },
      { actorId: admin.id, action: 'admin.access.api', metadata: JSON.stringify({ success: true }), ip: '192.168.1.1' },
      { actorId: user2.id, action: 'user.login', ip: '172.16.0.1', userAgent: 'Firefox/121' },
      { actorId: admin.id, userId: user3.id, action: 'admin.user.suspended', targetType: 'User', targetId: user3.id, metadata: JSON.stringify({ reason: 'TOS violation' }), ip: '192.168.1.1' },
    ],
  })
  console.log('  ✓ Audit events created')

  // --- Announcements ---
  await prisma.announcement.create({
    data: {
      title: 'Welcome to KeyHub v2!',
      body: 'We have launched a major update with organizations, TOTP, and more.',
      type: 'info',
      targetRole: 'all',
      createdBy: admin.id,
    },
  })

  await prisma.announcement.create({
    data: {
      title: 'Scheduled Maintenance',
      body: 'We will be performing maintenance on March 15th from 2-4 AM UTC.',
      type: 'warning',
      targetRole: 'all',
      createdBy: admin.id,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  })

  console.log('  ✓ Announcements created')

  // --- Prompt Templates ---
  await prisma.promptTemplate.createMany({
    data: [
      {
        userId: user1.id,
        name: 'Code Review',
        description: 'Review code for bugs and improvements',
        systemPrompt: 'You are an expert code reviewer. Analyze the provided code for bugs, security issues, and improvement suggestions.',
      },
      {
        userId: user1.id,
        name: 'Summarizer',
        description: 'Summarize long text concisely',
        systemPrompt: 'You are a summarization expert. Provide concise, accurate summaries of the provided text.',
      },
      {
        userId: user2.id,
        name: 'Translator',
        description: 'Translate between languages',
        systemPrompt: 'You are a professional translator. Translate the provided text accurately while preserving tone and meaning.',
      },
    ],
  })

  console.log('  ✓ Prompt templates created')

  // --- Feature Flags ---
  await prisma.featureFlag.createMany({
    data: [
      { key: 'playground', description: 'Enable the AI playground feature', enabled: true, rolloutPercent: 100 },
      { key: 'organizations', description: 'Enable multi-org support', enabled: true, rolloutPercent: 100 },
      { key: 'webhooks', description: 'Enable webhook integrations', enabled: true, rolloutPercent: 100 },
      { key: 'anomaly_detection', description: 'Enable anomaly detection alerts', enabled: false, rolloutPercent: 50 },
      { key: 'new_dashboard', description: 'New dashboard UI (beta)', enabled: false, rolloutPercent: 0, allowedUserIds: [admin.id] },
    ],
  })

  console.log('  ✓ Feature flags created')

  // --- Webhook Endpoints ---
  await prisma.webhookEndpoint.create({
    data: {
      userId: user1.id,
      url: 'https://webhook.site/test-alice',
      secret: 'whsec_alice_test_secret_123',
      events: ['budget.threshold', 'budget.exhausted', 'key.expired'],
      active: true,
    },
  })

  console.log('  ✓ Webhooks created')

  // --- Credit Transactions ---
  await prisma.creditTransaction.createMany({
    data: [
      { userId: user1.id, amount: 50, reason: 'Welcome bonus', adminId: admin.id },
      { userId: user1.id, amount: -10.5, reason: 'Monthly usage deduction' },
      { userId: user2.id, amount: 25, reason: 'Welcome bonus', adminId: admin.id },
    ],
  })

  console.log('  ✓ Credit transactions created')

  // --- Usage Summaries ---
  const today = new Date()
  for (let d = 0; d < 14; d++) {
    const date = new Date(today)
    date.setDate(date.getDate() - d)
    date.setHours(0, 0, 0, 0)

    await prisma.usageSummary.createMany({
      data: [
        {
          userId: user1.id,
          provider: 'openai',
          model: 'gpt-4o',
          date,
          requests: Math.floor(Math.random() * 100) + 10,
          tokens: Math.floor(Math.random() * 50000) + 5000,
          costUsd: Math.round((Math.random() * 5 + 0.5) * 100) / 100,
          failedReqs: Math.floor(Math.random() * 3),
        },
        {
          userId: user1.id,
          provider: 'anthropic',
          model: 'claude-sonnet-4-20250514',
          date,
          requests: Math.floor(Math.random() * 50) + 5,
          tokens: Math.floor(Math.random() * 30000) + 3000,
          costUsd: Math.round((Math.random() * 3 + 0.2) * 100) / 100,
          failedReqs: Math.floor(Math.random() * 2),
        },
      ],
    })
  }

  console.log('  ✓ Usage summaries created')

  console.log('\n📊 Seed Summary:')
  console.log('  Plans: Free, Pro, Enterprise')
  console.log('  Users:')
  console.log('    - admin@keyhub.dev / admin123 (SUPER_ADMIN, Enterprise plan)')
  console.log('    - alice@example.com / user123 (USER, Pro plan)')
  console.log('    - bob@example.com / user123 (USER, Free plan)')
  console.log('    - charlie@example.com / user123 (USER, Suspended)')
  console.log('    - unverified@example.com / user123 (USER, Unverified)')
  console.log(`  Provider Keys: 4`)
  console.log(`  Platform Keys: 3`)
  console.log(`  Request Logs: ${logs.length}`)
  console.log('  Organizations: Acme Corp, Startup Inc')
  console.log('  Feature Flags: 5')
  console.log('\n✅ Seed complete!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
