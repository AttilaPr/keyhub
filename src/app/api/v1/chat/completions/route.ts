import { streamText } from 'ai'
import { NextResponse } from 'next/server'
import { parseModel } from '@/lib/model-routing'
import { decryptKey } from '@/lib/encryption'
import { PROVIDERS, type ProviderName } from '@/lib/providers'
import { calculateCost, MODEL_PRICING } from '@/lib/cost-calculator'
import { verifyPlatformKey } from '@/lib/platform-key'
import { checkUserBudget, checkKeyBudget, getPeriodEnd } from '@/lib/budget'
import { withRetry } from '@/lib/retry'
import { isIpAllowed } from '@/lib/ip-utils'
import { mapModelToProvider } from '@/lib/model-mapping'
import { dispatchWebhook } from '@/lib/webhooks'
import { sendEmail } from '@/lib/email'
import { budgetExhaustedEmail } from '@/lib/email-templates'
import { selectProviderKey, updateLatencyEma } from '@/lib/load-balancer'
import prisma from '@/lib/prisma'

/** Fire-and-forget budget check after a successful request */
function triggerBudgetCheck(userId: string, platformKeyId: string) {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  fetch(`${baseUrl}/api/budget/check`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': process.env.INTERNAL_API_SECRET || '',
    },
    body: JSON.stringify({ userId, platformKeyId }),
  }).catch((err) => {
    console.error('[proxy] Failed to trigger budget check:', err)
  })
}

function estimateInputTokens(messages: Array<{ role: string; content: string }>): number {
  const totalChars = messages.reduce((sum, msg) => {
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
    return sum + content.length
  }, 0)
  return Math.ceil(totalChars / 4)
}

/** Build rate limit headers for the response */
function buildRateLimitHeaders(
  rateLimit: number | null,
  recentCount: number,
  requestId: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Request-ID': requestId,
  }
  if (rateLimit) {
    const windowResetAt = Math.ceil((Date.now() + 60_000) / 1000)
    headers['X-RateLimit-Limit'] = String(rateLimit)
    headers['X-RateLimit-Remaining'] = String(Math.max(0, rateLimit - recentCount - 1))
    headers['X-RateLimit-Reset'] = String(windowResetAt)
  } else {
    headers['X-RateLimit-Limit'] = 'unlimited'
    headers['X-RateLimit-Remaining'] = 'unlimited'
    headers['X-RateLimit-Reset'] = '0'
  }
  return headers
}

export async function POST(req: Request) {
  const start = Date.now()
  const requestId = crypto.randomUUID()

  const authHeader = req.headers.get('Authorization')
  const rawKey = authHeader?.replace('Bearer ', '')
  if (!rawKey) {
    return NextResponse.json({ error: 'Missing API key' }, { status: 401 })
  }

  const prefix = rawKey.slice(0, 16)
  const platformKeys = await prisma.platformKey.findMany({
    where: { keyPrefix: { startsWith: prefix.slice(0, 12) }, isActive: true },
  })

  let platformKey = null
  for (const pk of platformKeys) {
    if (await verifyPlatformKey(rawKey, pk.keyHash)) {
      platformKey = pk
      break
    }
  }

  if (!platformKey) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
  }

  // Revocation check
  if (platformKey.revokedAt) {
    return NextResponse.json({ error: 'API key has been revoked' }, { status: 401 })
  }

  // Expiration check
  if (platformKey.expiresAt && new Date(platformKey.expiresAt) <= new Date()) {
    return NextResponse.json(
      { error: 'API key has expired. Generate a new key in your dashboard.' },
      { status: 403 }
    )
  }

  // IP allowlist check (supports exact IPs and CIDR ranges)
  if (platformKey.ipAllowlist.length > 0) {
    const forwarded = req.headers.get('x-forwarded-for')
    const clientIp = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1'
    if (!isIpAllowed(clientIp, platformKey.ipAllowlist)) {
      return NextResponse.json({ error: 'IP not allowed' }, { status: 403 })
    }
  }

  // Rate limit check (requests per minute)
  const windowStart = new Date(Date.now() - 60_000)
  let recentCount = 0
  if (platformKey.rateLimit) {
    recentCount = await prisma.requestLog.count({
      where: {
        platformKeyId: platformKey.id,
        createdAt: { gte: windowStart },
      },
    })
    if (recentCount >= platformKey.rateLimit) {
      const windowResetAt = Math.ceil((Date.now() + 60_000) / 1000)
      return NextResponse.json(
        { error: `Rate limit exceeded. Max ${platformKey.rateLimit} requests per minute.` },
        {
          status: 429,
          headers: {
            'Retry-After': '60',
            'X-Request-ID': requestId,
            'X-RateLimit-Limit': String(platformKey.rateLimit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(windowResetAt),
          },
        }
      )
    }
  }

  // Build rate limit headers for successful responses
  const rateLimitHeaders = buildRateLimitHeaders(platformKey.rateLimit, recentCount, requestId)

  // Budget checks
  const userBudget = await checkUserBudget(platformKey.userId)
  if (userBudget.exceeded) {
    // Send budget exhausted email (fire-and-forget)
    const budgetUser = await prisma.user.findUnique({
      where: { id: platformKey.userId },
      select: { email: true, emailBudgetAlerts: true, lastBudgetAlertSentAt: true },
    })
    if (budgetUser?.emailBudgetAlerts) {
      const cooldownOk =
        !budgetUser.lastBudgetAlertSentAt ||
        Date.now() - new Date(budgetUser.lastBudgetAlertSentAt).getTime() > 3600000
      if (cooldownOk) {
        const html = budgetExhaustedEmail(userBudget.used, userBudget.limit!, 'monthly')
        sendEmail(budgetUser.email, 'Budget Exhausted — KeyHub', html).catch(() => {})
        dispatchWebhook(platformKey.userId, 'budget.exhausted', {
          type: 'user',
          used: userBudget.used,
          limit: userBudget.limit,
          percent: userBudget.percent,
          reset: getPeriodEnd('monthly').toISOString(),
        }).catch(() => {})
        prisma.user.update({
          where: { id: platformKey.userId },
          data: { lastBudgetAlertSentAt: new Date() },
        }).catch(() => {})
      }
    }

    const reset = getPeriodEnd('monthly').toISOString()
    return NextResponse.json(
      { error: 'Budget limit reached', reset },
      { status: 429, headers: rateLimitHeaders }
    )
  }

  // Soft cap: budget exceeded but no hard cap — allow request, dispatch webhook alert
  if (userBudget.alerting && !userBudget.exceeded && userBudget.percent >= 1) {
    dispatchWebhook(platformKey.userId, 'budget.exhausted', {
      type: 'user',
      used: userBudget.used,
      limit: userBudget.limit,
      percent: userBudget.percent,
      reset: getPeriodEnd('monthly').toISOString(),
    }).catch(() => {})
  } else if (userBudget.alerting) {
    dispatchWebhook(platformKey.userId, 'budget.threshold', {
      type: 'user',
      used: userBudget.used,
      limit: userBudget.limit,
      percent: userBudget.percent,
      reset: getPeriodEnd('monthly').toISOString(),
    }).catch(() => {})
  }

  const keyBudget = await checkKeyBudget(platformKey.id)
  if (keyBudget.exceeded) {
    const pkData = await prisma.platformKey.findUnique({
      where: { id: platformKey.id },
      select: { budgetPeriod: true },
    })
    const reset = getPeriodEnd(pkData?.budgetPeriod ?? 'monthly').toISOString()
    return NextResponse.json(
      { error: 'Key budget limit reached', reset },
      { status: 429, headers: rateLimitHeaders }
    )
  }

  let body: { model: string; messages: Array<{ role: string; content: string }>; stream?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { model } = body
  let { messages } = body

  if (!model || typeof model !== 'string') {
    return NextResponse.json({ error: 'model is required and must be a string' }, { status: 400 })
  }

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'messages is required and must be a non-empty array' }, { status: 400 })
  }

  if (messages.length > 256) {
    return NextResponse.json({ error: 'messages array exceeds maximum of 256 messages' }, { status: 400 })
  }

  const validRoles = new Set(['user', 'assistant', 'system', 'tool'])
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    if (!msg || typeof msg !== 'object') {
      return NextResponse.json({ error: `messages[${i}] must be an object` }, { status: 400 })
    }
    if (!msg.role || typeof msg.role !== 'string' || !validRoles.has(msg.role)) {
      return NextResponse.json({ error: `messages[${i}].role must be one of: ${[...validRoles].join(', ')}` }, { status: 400 })
    }
    if (msg.content === undefined || msg.content === null) {
      return NextResponse.json({ error: `messages[${i}].content is required` }, { status: 400 })
    }
  }

  // Tag header: accept X-KeyHub-Tag for per-tag analytics (max 64 chars, alphanumeric + hyphens)
  const rawTag = req.headers.get('X-KeyHub-Tag')
  let tag: string | null = null
  if (rawTag) {
    const trimmed = rawTag.trim().slice(0, 64)
    if (/^[a-zA-Z0-9-]+$/.test(trimmed)) {
      tag = trimmed
    }
  }

  // Template integration: prepend system prompt from template if X-KeyHub-Template header is set
  const templateId = req.headers.get('X-KeyHub-Template')
  if (templateId) {
    const template = await prisma.promptTemplate.findUnique({
      where: { id: templateId },
      select: { id: true, userId: true, systemPrompt: true },
    })

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Verify template belongs to the platform key's owner
    if (template.userId !== platformKey.userId) {
      return NextResponse.json(
        { error: 'Template does not belong to this key\'s owner' },
        { status: 403 }
      )
    }

    // Prepend template's systemPrompt as first message with role "system"
    messages = [
      { role: 'system', content: template.systemPrompt },
      ...messages,
    ]
  }

  let provider: string, modelId: string
  try {
    ({ provider, modelId } = parseModel(model))
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }

  if (!(provider in PROVIDERS)) {
    return NextResponse.json({ error: `Unsupported provider: ${provider}` }, { status: 400 })
  }

  // Key scoping: provider restriction
  if (platformKey.allowedProviders.length > 0 && !platformKey.allowedProviders.includes(provider)) {
    return NextResponse.json(
      { error: `This key is not permitted to use provider: ${provider}` },
      { status: 403 }
    )
  }

  // Key scoping: model restriction
  if (platformKey.allowedModels.length > 0 && !platformKey.allowedModels.includes(model)) {
    return NextResponse.json(
      { error: `This key is not permitted to use model: ${model}` },
      { status: 403 }
    )
  }

  // Pre-flight cost estimation
  if (platformKey.maxCostPerRequest) {
    const estimatedTokens = estimateInputTokens(messages)
    const pricing = MODEL_PRICING[modelId]
    if (pricing) {
      const estimatedInputCost = (estimatedTokens / 1_000_000) * pricing.input
      if (estimatedInputCost > platformKey.maxCostPerRequest) {
        return NextResponse.json(
          { error: 'Estimated cost exceeds max cost per request limit' },
          { status: 403 }
        )
      }
    }
  }

  // Fetch ALL active provider keys for load balancing
  const providerKeys = await prisma.providerKey.findMany({
    where: { userId: platformKey.userId, provider, isActive: true },
  })

  if (providerKeys.length === 0) {
    return NextResponse.json(
      { error: `No ${provider} key found. Add one in your dashboard.` },
      { status: 400 }
    )
  }

  // Select provider key based on platform key's routing strategy
  const routingStrategy = (platformKey as any).routingStrategy || 'round-robin'
  const providerKey = selectProviderKey(providerKeys, routingStrategy)

  const apiKey = decryptKey(providerKey.encryptedKey)
  const createProvider = PROVIDERS[provider as ProviderName]
  const providerInstance = createProvider(apiKey)

  // Track retry count for the request log
  let retryCount = 0

  // Per-key retry override
  const retryConfig = platformKey.maxRetries != null ? { maxRetries: platformKey.maxRetries } : {}

  try {
    const { result: streamResult, retryCount: retries } = await withRetry(async () => {
      return streamText({
        model: providerInstance(modelId),
        messages: messages as any,
        onFinish: async ({ usage, text }) => {
          const promptTokens = (usage as any)?.promptTokens ?? (usage as any)?.inputTokens ?? 0
          const completionTokens = (usage as any)?.completionTokens ?? (usage as any)?.outputTokens ?? 0
          const costUsd = calculateCost(modelId, promptTokens, completionTokens)

          // Post-request cost check — log warning if total cost exceeds maxCostPerRequest
          if (platformKey.maxCostPerRequest && costUsd > platformKey.maxCostPerRequest) {
            console.warn(
              `[cost-warning] Request cost $${costUsd.toFixed(6)} exceeded maxCostPerRequest $${platformKey.maxCostPerRequest} for platform key ${platformKey.id}`
            )
          }

          await prisma.requestLog.create({
            data: {
              requestId,
              userId: platformKey.userId,
              platformKeyId: platformKey.id,
              providerKeyId: providerKey.id,
              provider,
              model: modelId,
              promptTokens,
              completionTokens,
              totalTokens: promptTokens + completionTokens,
              costUsd,
              retryCount,
              status: 'success',
              latencyMs: Date.now() - start,
              tag,
              prompt: JSON.stringify(messages),
              response: text,
            },
          })

          await prisma.platformKey.update({
            where: { id: platformKey.id },
            data: { lastUsedAt: new Date() },
          })

          // Update latency EMA on the provider key
          const latencyMs = Date.now() - start
          const newEma = updateLatencyEma(latencyMs, providerKey.latencyEma)
          prisma.providerKey.update({
            where: { id: providerKey.id },
            data: { latencyEma: newEma },
          }).catch(() => {})

          // Asynchronous budget check after successful logging
          triggerBudgetCheck(platformKey.userId, platformKey.id)
        },
      })
    }, retryConfig)

    retryCount = retries

    const streamResponse = streamResult.toTextStreamResponse()
    // Append rate limit headers to the streaming response
    const responseHeaders = new Headers(streamResponse.headers)
    for (const [key, value] of Object.entries(rateLimitHeaders)) {
      responseHeaders.set(key, value)
    }
    return new Response(streamResponse.body, {
      status: streamResponse.status,
      headers: responseHeaders,
    })
  } catch (err: any) {
    // Extract error status code from the provider error
    const errorStatus = err?.status ?? err?.statusCode ?? 500

    // --- Fallback Routing ---
    // Check if there are fallback rules for this platform key and provider
    const fallbackRules = await prisma.fallbackRule.findMany({
      where: {
        platformKeyId: platformKey.id,
        primaryProvider: provider,
        triggerOnStatus: { hasSome: [errorStatus] },
      },
      orderBy: { priority: 'asc' },
    })

    for (const rule of fallbackRules) {
      const fbProvider = rule.fallbackProvider
      if (!(fbProvider in PROVIDERS)) continue

      // Find an active provider key for the fallback provider
      const fbProviderKey = await prisma.providerKey.findFirst({
        where: { userId: platformKey.userId, provider: fbProvider, isActive: true },
      })
      if (!fbProviderKey) continue

      // Map the model to an equivalent on the fallback provider
      const fbModelId = mapModelToProvider(modelId, fbProvider)
      if (!fbModelId) continue

      try {
        const fbApiKey = decryptKey(fbProviderKey.encryptedKey)
        const fbCreateProvider = PROVIDERS[fbProvider as ProviderName]
        const fbProviderInstance = fbCreateProvider(fbApiKey)

        const { result: fbStreamResult } = await withRetry(async () => {
          return streamText({
            model: fbProviderInstance(fbModelId),
            messages: messages as any,
            onFinish: async ({ usage, text }) => {
              const promptTokens = (usage as any)?.promptTokens ?? (usage as any)?.inputTokens ?? 0
              const completionTokens = (usage as any)?.completionTokens ?? (usage as any)?.outputTokens ?? 0
              const costUsd = calculateCost(fbModelId, promptTokens, completionTokens)

              await prisma.requestLog.create({
                data: {
                  requestId,
                  userId: platformKey.userId,
                  platformKeyId: platformKey.id,
                  providerKeyId: fbProviderKey.id,
                  provider: fbProvider,
                  model: fbModelId,
                  promptTokens,
                  completionTokens,
                  totalTokens: promptTokens + completionTokens,
                  costUsd,
                  retryCount,
                  status: 'success',
                  fallbackUsed: true,
                  originalProvider: provider,
                  fallbackProvider: fbProvider,
                  latencyMs: Date.now() - start,
                  tag,
                  prompt: JSON.stringify(messages),
                  response: text,
                },
              })

              await prisma.platformKey.update({
                where: { id: platformKey.id },
                data: { lastUsedAt: new Date() },
              })

              // Asynchronous budget check after successful fallback logging
              triggerBudgetCheck(platformKey.userId, platformKey.id)
            },
          })
        })

        // Fallback succeeded — return with rate limit headers
        const fbStreamResponse = fbStreamResult.toTextStreamResponse()
        const fbResponseHeaders = new Headers(fbStreamResponse.headers)
        for (const [key, value] of Object.entries(rateLimitHeaders)) {
          fbResponseHeaders.set(key, value)
        }
        return new Response(fbStreamResponse.body, {
          status: fbStreamResponse.status,
          headers: fbResponseHeaders,
        })
      } catch {
        // Fallback provider also failed, try next rule
        continue
      }
    }

    // No fallback succeeded (or no rules matched) — log original error
    await prisma.requestLog.create({
      data: {
        requestId,
        userId: platformKey.userId,
        platformKeyId: platformKey.id,
        providerKeyId: providerKey.id,
        provider,
        model: modelId,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        costUsd: 0,
        retryCount,
        status: 'failed',
        errorMessage: err.message,
        latencyMs: Date.now() - start,
        tag,
        prompt: JSON.stringify(messages),
      },
    })
    return NextResponse.json({ error: err.message }, { status: 500, headers: rateLimitHeaders })
  }
}
