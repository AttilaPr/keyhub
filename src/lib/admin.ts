import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rate-limit'

// ---------------------------------------------------------------------------
// ADMIN_SECRET_KEY startup check
// ---------------------------------------------------------------------------
if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_SECRET_KEY) {
  console.error(
    '\x1b[31m[CRITICAL] ADMIN_SECRET_KEY env var is not set in production! ' +
    'The admin panel will not be fully secured. Set ADMIN_SECRET_KEY to a strong random value.\x1b[0m'
  )
}

// ---------------------------------------------------------------------------
// Audit logging
// ---------------------------------------------------------------------------

/**
 * Log admin access attempt to audit trail.
 * Non-blocking: errors are caught and logged to console.
 */
async function logAdminAccess(
  actorId: string | null,
  action: string,
  success: boolean,
  req?: Request,
) {
  try {
    const ip = req?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
    const userAgent = req?.headers.get('user-agent') ?? null

    await prisma.auditEvent.create({
      data: {
        actorId,
        action: success ? `admin.access.${action}` : `admin.access.denied.${action}`,
        metadata: JSON.stringify({ success, timestamp: new Date().toISOString() }),
        ip,
        userAgent,
      },
    })
  } catch (err) {
    console.error('[admin-audit] Failed to log access:', err)
  }
}

// ---------------------------------------------------------------------------
// Admin route protection
// ---------------------------------------------------------------------------

export function withSuperAdmin(
  handler: (req: Request, userId: string) => Promise<NextResponse>
) {
  return async (req: Request) => {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'

    // Check if IP is currently blocked (check-only, don't increment)
    const ipRl = await checkRateLimit(`admin_ip:${ip}`, {
      maxAttempts: 10,
      windowMs: 10 * 60 * 1000,
      blockDurationMs: 15 * 60 * 1000,
      checkOnly: true,
    })
    if (!ipRl.allowed) {
      return NextResponse.json(
        { error: 'Too many failed attempts. Try again later.' },
        { status: 429 }
      )
    }

    const session = await auth()

    if (!session?.user?.id || session.user.role !== 'SUPER_ADMIN') {
      // Log failed access attempt and increment IP rate limit
      const actorId = session?.user?.id ?? null
      logAdminAccess(actorId, 'api', false, req).catch(() => {})
      await checkRateLimit(`admin_ip:${ip}`, {
        maxAttempts: 10,
        windowMs: 10 * 60 * 1000,
        blockDurationMs: 15 * 60 * 1000,
      }).catch(() => {})
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Database-backed admin API rate limit (60 req/min)
    const apiRl = await checkRateLimit(`admin_api:${session.user.id}`, {
      maxAttempts: 60,
      windowMs: 60 * 1000,
    })
    if (!apiRl.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((apiRl.resetAt - Date.now()) / 1000)),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(apiRl.resetAt / 1000)),
          },
        }
      )
    }

    // Log successful access
    logAdminAccess(session.user.id, 'api', true, req).catch(() => {})

    return handler(req, session.user.id)
  }
}

export async function requireSuperAdmin(req?: Request) {
  const ip = req?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'

  // Check if IP is currently blocked (check-only, don't increment)
  const ipRl = await checkRateLimit(`admin_ip:${ip}`, {
    maxAttempts: 10,
    windowMs: 10 * 60 * 1000,
    blockDurationMs: 15 * 60 * 1000,
    checkOnly: true,
  })
  if (!ipRl.allowed) {
    return null
  }

  const session = await auth()

  if (!session?.user?.id || session.user.role !== 'SUPER_ADMIN') {
    // Log failed access attempt and increment IP rate limit
    const actorId = session?.user?.id ?? null
    logAdminAccess(actorId, 'page', false, req).catch(() => {})
    await checkRateLimit(`admin_ip:${ip}`, {
      maxAttempts: 10,
      windowMs: 10 * 60 * 1000,
      blockDurationMs: 15 * 60 * 1000,
    }).catch(() => {})
    return null
  }

  // Database-backed admin API rate limit
  const apiRl = await checkRateLimit(`admin_api:${session.user.id}`, {
    maxAttempts: 60,
    windowMs: 60 * 1000,
  })
  if (!apiRl.allowed) {
    return null
  }

  return session
}
