import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { checkAdminRateLimit } from '@/lib/admin-rate-limit'

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
// Admin auth failure tracking (in-memory, per IP)
// ---------------------------------------------------------------------------
interface AuthFailureEntry {
  count: number
  firstFailureAt: number
  blockedUntil: number
}

const authFailureStore = new Map<string, AuthFailureEntry>()

const AUTH_FAILURE_WINDOW_MS = 10 * 60 * 1000 // 10 minutes
const AUTH_FAILURE_THRESHOLD = 3
const AUTH_BLOCK_DURATION_MS = 15 * 60 * 1000 // 15 minutes
const FAILURE_CLEANUP_INTERVAL = 5 * 60 * 1000 // 5 minutes
let lastFailureCleanup = Date.now()

function cleanupAuthFailures() {
  const now = Date.now()
  if (now - lastFailureCleanup < FAILURE_CLEANUP_INTERVAL) return
  lastFailureCleanup = now
  for (const [key, entry] of authFailureStore) {
    if (entry.blockedUntil < now && now - entry.firstFailureAt > AUTH_FAILURE_WINDOW_MS) {
      authFailureStore.delete(key)
    }
  }
}

function isIpBlocked(ip: string): boolean {
  cleanupAuthFailures()
  const entry = authFailureStore.get(ip)
  if (!entry) return false
  if (entry.blockedUntil > Date.now()) return true
  return false
}

function recordAuthFailure(ip: string): void {
  cleanupAuthFailures()
  const now = Date.now()
  const entry = authFailureStore.get(ip)

  if (!entry || now - entry.firstFailureAt > AUTH_FAILURE_WINDOW_MS) {
    // Start a new tracking window
    authFailureStore.set(ip, {
      count: 1,
      firstFailureAt: now,
      blockedUntil: 0,
    })
    return
  }

  entry.count++
  if (entry.count >= AUTH_FAILURE_THRESHOLD) {
    entry.blockedUntil = now + AUTH_BLOCK_DURATION_MS
    console.warn(
      `[admin-security] IP ${ip} blocked for ${AUTH_BLOCK_DURATION_MS / 60000} minutes after ${entry.count} failed admin auth attempts`
    )
  }
}

// ---------------------------------------------------------------------------
// Audit logging
// ---------------------------------------------------------------------------

/**
 * Log admin access attempt to audit trail.
 * Non-blocking: errors are caught and logged to console.
 */
async function logAdminAccess(
  actorId: string,
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

export async function withSuperAdmin(
  handler: (req: Request, userId: string) => Promise<NextResponse>
) {
  return async (req: Request) => {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'

    // Check IP block first
    if (isIpBlocked(ip)) {
      return NextResponse.json(
        { error: 'Too many failed attempts. Try again later.' },
        { status: 429 }
      )
    }

    const session = await auth()

    if (!session?.user?.id || session.user.role !== 'SUPER_ADMIN') {
      // Record failure by IP
      recordAuthFailure(ip)

      // Log failed access attempt if we have a user ID
      if (session?.user?.id) {
        logAdminAccess(session.user.id, 'api', false, req).catch(() => {})
      } else {
        // Log anonymous failed attempt with a placeholder actor
        logAdminAccess('anonymous', 'api', false, req).catch(() => {})
      }
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Check rate limit
    const rateLimit = checkAdminRateLimit(session.user.id)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(rateLimit.resetAt / 1000)),
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

  // Check IP block
  if (isIpBlocked(ip)) {
    return null
  }

  const session = await auth()

  if (!session?.user?.id || session.user.role !== 'SUPER_ADMIN') {
    // Record failure by IP and log to audit trail
    recordAuthFailure(ip)

    if (session?.user?.id) {
      logAdminAccess(session.user.id, 'page', false, req).catch(() => {})
    } else {
      logAdminAccess('anonymous', 'page', false, req).catch(() => {})
    }

    return null
  }

  // Check rate limit
  const rateLimit = checkAdminRateLimit(session.user.id)
  if (!rateLimit.allowed) {
    return null
  }

  return session
}
