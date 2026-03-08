import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin'
import { getAllConfig, setConfig, CONFIG_DEFAULTS } from '@/lib/system-config'

export async function GET() {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const config = await getAllConfig()
  return NextResponse.json(config)
}

export async function PATCH(req: Request) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const validKeys = Object.keys(CONFIG_DEFAULTS)
  const updates: Record<string, any> = {}

  for (const [key, value] of Object.entries(body)) {
    if (!validKeys.includes(key)) {
      return NextResponse.json({ error: `Unknown config key: ${key}` }, { status: 400 })
    }
    updates[key] = value
  }

  for (const [key, value] of Object.entries(updates)) {
    await setConfig(key, value, session.user.id)
  }

  const config = await getAllConfig()
  return NextResponse.json(config)
}
