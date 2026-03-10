import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin'
import prisma from '@/lib/prisma'
import { logAuditEvent, getRequestMeta } from '@/lib/audit'
import { dispatchWebhook } from '@/lib/webhooks'
import { encode } from 'next-auth/jwt'
import { cookies } from 'next/headers'
import { decryptKey } from '@/lib/encryption'
import { verifyTotpCode } from '@/lib/totp'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await requireSuperAdmin(req)
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { userId } = await params
  const body = await req.json().catch(() => ({}))

  // Cannot impersonate yourself
  if (userId === session.user.id) {
    return NextResponse.json({ error: 'Cannot impersonate yourself' }, { status: 400 })
  }

  // Check if already impersonating
  if (session.impersonating) {
    return NextResponse.json(
      { error: 'Already impersonating. Exit current impersonation first.' },
      { status: 400 }
    )
  }

  // Enforce TOTP if admin has it enabled
  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { totpEnabled: true, totpSecret: true },
  })
  if (admin?.totpEnabled) {
    const { totpCode } = body
    if (!totpCode || typeof totpCode !== 'string' || !/^\d{6}$/.test(totpCode)) {
      return NextResponse.json(
        { error: 'TOTP code required for impersonation' },
        { status: 400 }
      )
    }
    if (!admin.totpSecret) {
      return NextResponse.json({ error: 'TOTP configuration error' }, { status: 500 })
    }

    // Rate limit TOTP attempts for impersonation (check only — don't increment on every attempt)
    const totpRl = await checkRateLimit(`totp_impersonate:${session.user.id}`, {
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000,
      blockDurationMs: 30 * 60 * 1000,
      checkOnly: true,
    })
    if (!totpRl.allowed) {
      return NextResponse.json({ error: 'Too many TOTP attempts. Try again later.' }, { status: 429 })
    }

    try {
      const secret = decryptKey(admin.totpSecret)
      if (!verifyTotpCode(secret, totpCode)) {
        // Increment rate limit only on failed TOTP attempt
        await checkRateLimit(`totp_impersonate:${session.user.id}`, {
          maxAttempts: 5,
          windowMs: 15 * 60 * 1000,
          blockDurationMs: 30 * 60 * 1000,
        }).catch(() => {})
        return NextResponse.json({ error: 'Invalid TOTP code' }, { status: 403 })
      }
    } catch (err) {
      console.error('[impersonate] TOTP verification failed:', err)
      return NextResponse.json({ error: 'TOTP verification failed' }, { status: 500 })
    }
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, suspended: true },
  })

  if (!targetUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (targetUser.suspended) {
    return NextResponse.json({ error: 'Cannot impersonate a suspended user' }, { status: 400 })
  }

  // Create impersonation JWT
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  // Set the session cookie
  const cookieStore = await cookies()
  const isSecure = process.env.NEXTAUTH_URL?.startsWith('https') ?? false
  const cookieName = isSecure
    ? '__Secure-authjs.session-token'
    : 'authjs.session-token'

  const token = await encode({
    token: {
      id: targetUser.id,
      email: targetUser.email,
      name: targetUser.name,
      role: targetUser.role,
      impersonating: targetUser.email,
      impersonatedBy: session.user.id,
      originalAdminId: session.user.id,
      originalAdminRole: session.user.role,
      issuedAt: Date.now(),
    },
    secret,
    salt: cookieName,
    maxAge: 15 * 60,
  } as Parameters<typeof encode>[0])
  cookieStore.set(cookieName, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 15 * 60, // 15 minutes
  })

  const meta = getRequestMeta(req)
  await logAuditEvent({
    actorId: session.user.id,
    userId,
    action: 'admin.user.impersonated',
    targetType: 'User',
    targetId: userId,
    metadata: {
      targetEmail: targetUser.email,
      adminEmail: session.user.email,
    },
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  // Dispatch webhook event for impersonation start
  dispatchWebhook(userId, 'admin.impersonation.started', {
    adminId: session.user.id,
    adminEmail: session.user.email,
    targetUserId: targetUser.id,
    targetEmail: targetUser.email,
    timestamp: new Date().toISOString(),
  }).catch(() => {})

  return NextResponse.json({
    success: true,
    targetUser: {
      id: targetUser.id,
      email: targetUser.email,
      name: targetUser.name,
    },
  })
}
