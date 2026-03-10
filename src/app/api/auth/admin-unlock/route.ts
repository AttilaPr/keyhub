import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createHash } from 'crypto'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const adminSecretKey = process.env.ADMIN_SECRET_KEY
  if (!adminSecretKey) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Rate limit: 5 attempts per 15 minutes per user
  const rl = await checkRateLimit(`admin_unlock:${session.user.id}`, {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000,
    blockDurationMs: 30 * 60 * 1000,
  })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
  }

  let key: string
  try {
    const body = await req.json()
    key = body.key
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  if (!key || typeof key !== 'string') {
    return NextResponse.json({ error: 'Key required' }, { status: 400 })
  }

  // Constant-time comparison using SHA-256 to normalize length
  const a = createHash('sha256').update(key).digest()
  const b = createHash('sha256').update(adminSecretKey).digest()
  // Use manual byte comparison since timingSafeEqual may not be available in all runtimes
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a[i] ^ b[i]
  }
  if (mismatch !== 0) {
    return NextResponse.json({ error: 'Invalid admin key' }, { status: 403 })
  }

  // Store a hash of the key in the cookie, not the raw secret
  const cookieValue = createHash('sha256').update(`keyhub_admin_session:${adminSecretKey}`).digest('hex')
  const response = NextResponse.json({ success: true })
  const isSecure = process.env.NODE_ENV === 'production'
  response.cookies.set('__keyhub_admin_key', cookieValue, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 8 * 60 * 60, // 8 hours
  })

  return response
}
