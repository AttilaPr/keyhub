import crypto from 'crypto'
import { isIP } from 'net'
import prisma from '@/lib/prisma'

const RETRY_DELAYS = [1000, 3000, 10000] // 1s, 3s, 10s

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * SSRF protection: block webhook URLs that resolve to private/internal IPs.
 * Checks the hostname against known private IP ranges and localhost.
 */
function isPrivateOrReservedHost(hostname: string): boolean {
  // Block localhost variants
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]') {
    return true
  }

  // Strip brackets from IPv6
  const cleanHost = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname

  // Check IPv6 private ranges
  if (isIP(cleanHost) === 6) {
    const lower = cleanHost.toLowerCase()
    // ::1 loopback
    if (lower === '::1') return true
    // fc00::/7 — unique local addresses (fc00:: and fd00::)
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true
    // fe80:: link-local
    if (lower.startsWith('fe80')) return true
    return false
  }

  // Check IPv4 private ranges
  if (isIP(cleanHost) === 4) {
    const parts = cleanHost.split('.').map(Number)
    if (parts.length !== 4) return false
    const [a, b] = parts
    // 127.0.0.0/8 — loopback
    if (a === 127) return true
    // 10.0.0.0/8 — private
    if (a === 10) return true
    // 172.16.0.0/12 — private
    if (a === 172 && b >= 16 && b <= 31) return true
    // 192.168.0.0/16 — private
    if (a === 192 && b === 168) return true
    // 169.254.0.0/16 — link-local
    if (a === 169 && b === 254) return true
    // 0.0.0.0
    if (a === 0) return true
    return false
  }

  return false
}

async function attemptDelivery(
  endpoint: { id: string; url: string; secret: string; failures: number },
  event: string,
  body: string,
  signature: string,
): Promise<{ statusCode: number | null; responseBody: string | null; delivered: boolean }> {
  let statusCode: number | null = null
  let responseBody: string | null = null
  let delivered = false

  try {
    const res = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-KeyHub-Signature': signature,
        'X-KeyHub-Event': event,
      },
      body,
      signal: AbortSignal.timeout(10000),
    })

    statusCode = res.status
    responseBody = await res.text().catch(() => null)
    delivered = res.ok
  } catch (err: any) {
    responseBody = err.message
  }

  return { statusCode, responseBody, delivered }
}

export async function dispatchWebhook(
  userId: string,
  event: string,
  payload: Record<string, unknown>,
) {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: {
      userId,
      active: true,
      events: { has: event },
    },
  })

  for (const endpoint of endpoints) {
    // SSRF protection: block requests to private/internal IPs
    try {
      const parsed = new URL(endpoint.url)
      if (isPrivateOrReservedHost(parsed.hostname)) {
        console.warn(`[webhooks] Blocked SSRF attempt to private IP: ${endpoint.url}`)
        await prisma.webhookDelivery.create({
          data: {
            endpointId: endpoint.id,
            event,
            payload: JSON.stringify({ event, data: payload }),
            statusCode: null,
            responseBody: 'Blocked: webhook URL points to a private/internal address',
            attemptCount: 0,
            failedAt: new Date(),
          },
        })
        continue
      }
    } catch {
      console.warn(`[webhooks] Invalid webhook URL: ${endpoint.url}`)
      continue
    }

    const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() })
    const signature = crypto
      .createHmac('sha256', endpoint.secret)
      .update(body)
      .digest('hex')

    let statusCode: number | null = null
    let responseBody: string | null = null
    let delivered = false
    let attemptCount = 0

    // Attempt delivery with retries (up to 3 attempts: initial + 2 retries)
    for (let attempt = 0; attempt < 3; attempt++) {
      attemptCount = attempt + 1
      const result = await attemptDelivery(endpoint, event, body, signature)
      statusCode = result.statusCode
      responseBody = result.responseBody
      delivered = result.delivered

      if (delivered) break

      // Wait before retrying (delays: 1s, 3s, 10s)
      if (attempt < 2) {
        await delay(RETRY_DELAYS[attempt])
      }
    }

    // Store delivery result
    await prisma.webhookDelivery.create({
      data: {
        endpointId: endpoint.id,
        event,
        payload: body,
        statusCode,
        responseBody,
        attemptCount,
        deliveredAt: delivered ? new Date() : null,
        failedAt: !delivered ? new Date() : null,
      },
    })

    if (delivered) {
      await prisma.webhookEndpoint.update({
        where: { id: endpoint.id },
        data: { failures: 0 },
      })
    } else {
      const newFailures = endpoint.failures + 1
      await prisma.webhookEndpoint.update({
        where: { id: endpoint.id },
        data: {
          failures: newFailures,
          active: newFailures >= 10 ? false : true,
        },
      })
    }
  }
}
