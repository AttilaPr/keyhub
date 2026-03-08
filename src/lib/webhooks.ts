import crypto from 'crypto'
import prisma from '@/lib/prisma'

const RETRY_DELAYS = [1000, 3000, 10000] // 1s, 3s, 10s

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
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
