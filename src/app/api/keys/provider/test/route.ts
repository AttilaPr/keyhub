import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { decryptKey } from '@/lib/encryption'

const PROVIDER_TEST_URLS: Record<string, { url: string | ((key: string) => string); headers: (key: string) => Record<string, string> }> = {
  openai: {
    url: 'https://api.openai.com/v1/models',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  anthropic: {
    url: 'https://api.anthropic.com/v1/models',
    headers: (key) => ({
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    }),
  },
  google: {
    url: (key) => `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=1`,
    headers: () => ({}),
  },
  mistral: {
    url: 'https://api.mistral.ai/v1/models',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await req.json()
  if (!id) {
    return NextResponse.json({ error: 'Missing key id' }, { status: 400 })
  }

  const providerKey = await prisma.providerKey.findFirst({
    where: { id, userId: session.user.id },
  })

  if (!providerKey) {
    return NextResponse.json({ error: 'Key not found' }, { status: 404 })
  }

  const config = PROVIDER_TEST_URLS[providerKey.provider]
  if (!config) {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })
  }

  const apiKey = decryptKey(providerKey.encryptedKey)
  const url = typeof config.url === 'function' ? config.url(apiKey) : config.url
  const headers = config.headers(apiKey)

  const start = Date.now()
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(15000),
    })
    const latencyMs = Date.now() - start

    if (res.ok) {
      return NextResponse.json({ success: true, latencyMs })
    }

    const body = await res.text()
    let message = `HTTP ${res.status}`
    try {
      const json = JSON.parse(body)
      message = json.error?.message || json.message || message
    } catch {}

    return NextResponse.json({ success: false, error: message, latencyMs })
  } catch (err: unknown) {
    const latencyMs = Date.now() - start
    const message = err instanceof Error ? (err.name === 'TimeoutError' ? 'Connection timed out (15s)' : err.message) : 'Unknown error'
    return NextResponse.json({ success: false, error: message, latencyMs })
  }
}
