import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

/** Lightweight CIDR check for middleware (no external deps) */
function ipToLong(ip: string): number {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) return -1
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
}

function isIpInCidr(ip: string, cidr: string): boolean {
  if (ip === cidr) return true
  if (!cidr.includes('/')) return false
  const [network, prefixStr] = cidr.split('/')
  const prefix = parseInt(prefixStr, 10)
  if (isNaN(prefix) || prefix < 0 || prefix > 32) return false
  const ipLong = ipToLong(ip)
  const netLong = ipToLong(network)
  if (ipLong === -1 || netLong === -1) return false
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0
  return ((ipLong & mask) >>> 0) === ((netLong & mask) >>> 0)
}

function isAdminIpAllowed(ip: string): boolean {
  const allowlist = process.env.ADMIN_IP_ALLOWLIST
  if (!allowlist) return true // no restriction if env var is not set
  const entries = allowlist.split(',').map((e) => e.trim()).filter(Boolean)
  if (entries.length === 0) return true
  return entries.some((entry) => isIpInCidr(ip, entry))
}

const CSRF_MAX_AGE_SECONDS = 60 * 60 // 1 hour

function generateCsrfToken(): string {
  const timestamp = Math.floor(Date.now() / 1000).toString(16)
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const random = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  return `${timestamp}.${random}`
}

function isCsrfTokenExpired(token: string): boolean {
  const dotIndex = token.indexOf('.')
  if (dotIndex === -1) return true // legacy format, treat as expired
  const timestampHex = token.substring(0, dotIndex)
  const issuedAt = parseInt(timestampHex, 16)
  if (isNaN(issuedAt)) return true
  const age = Math.floor(Date.now() / 1000) - issuedAt
  return age > CSRF_MAX_AGE_SECONDS || age < 0
}

async function computeAdminCookieHash(adminSecretKey: string): Promise<string> {
  const data = new TextEncoder().encode(`keyhub_admin_session:${adminSecretKey}`)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow public routes through (only NextAuth's own routes, not custom /api/auth/* endpoints)
  const nextAuthRoutes = ['/api/auth/callback', '/api/auth/signin', '/api/auth/signout', '/api/auth/session', '/api/auth/csrf', '/api/auth/providers', '/api/auth/error']
  const publicAuthRoutes = ['/api/auth/register', '/api/auth/verify-email', '/api/auth/resend-verification', '/api/auth/admin-unlock']
  if (
    nextAuthRoutes.some((r) => pathname.startsWith(r)) ||
    publicAuthRoutes.some((r) => pathname === r) ||
    pathname.startsWith('/api/v1') ||
    pathname.startsWith('/api/health') ||
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  const secureCookie = req.nextUrl.protocol === 'https:'
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, secureCookie })
  const isLoggedIn = !!token
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register')
  const isTotpPage = pathname === '/totp'
  const isAdminRoute = pathname.startsWith('/admin') || pathname.startsWith('/api/admin')

  // CSRF protection for ALL mutation API routes (POST, PATCH, DELETE)
  // Exempt: /api/auth (NextAuth), /api/v1 (already exempted above), admin routes (handled separately below)
  // Also exempt pre-authentication endpoints that have their own rate limiting
  const csrfExemptAuthRoutes = ['/api/auth/register', '/api/auth/verify-email', '/api/auth/resend-verification', '/api/auth/admin-unlock']
  const isCsrfExempt = csrfExemptAuthRoutes.some((r) => pathname === r)
  if (pathname.startsWith('/api/') && !isAdminRoute && !isCsrfExempt) {
    const method = req.method.toUpperCase()
    if (method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE') {
      const csrfHeader = req.headers.get('x-csrf-token')
      const csrfCookie = req.cookies.get('__keyhub_csrf')?.value
      if (csrfHeader && csrfCookie && csrfHeader === csrfCookie && !isCsrfTokenExpired(csrfCookie)) {
        // CSRF token is valid and not expired — proceed
      } else {
        // If no cookie set yet or token expired, generate a new one but still block the mutation
        if (!csrfCookie || isCsrfTokenExpired(csrfCookie)) {
          const csrfToken = generateCsrfToken()
          const response = NextResponse.json(
            { error: 'CSRF token missing or expired. Reload the page and try again.' },
            { status: 403 }
          )
          response.cookies.set('__keyhub_csrf', csrfToken, {
            httpOnly: false,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            maxAge: CSRF_MAX_AGE_SECONDS,
          })
          return response
        }
        return NextResponse.json(
          { error: 'CSRF token mismatch' },
          { status: 403 }
        )
      }
    }
  }

  // Admin routes: return 404 for non-admins to hide the panel's existence
  if (isAdminRoute) {
    // Allow impersonation exit even when impersonating a non-admin user
    const isImpersonationExit = pathname === '/api/admin/impersonate/exit' && token?.impersonatedBy
    if (!isLoggedIn || (token?.role !== 'SUPER_ADMIN' && !isImpersonationExit)) {
      return new NextResponse('Not Found', { status: 404 })
    }

    // ADMIN_SECRET_KEY enforcement: when set, require matching cookie on all admin routes
    // Skip for impersonation exit (already handled above)
    const adminSecretKey = process.env.ADMIN_SECRET_KEY
    if (adminSecretKey && !isImpersonationExit) {
      const providedKey = req.cookies.get('__keyhub_admin_key')?.value
      // Cookie stores a SHA-256 hash, not the raw key — compute expected hash
      const expectedHash = await computeAdminCookieHash(adminSecretKey)
      if (providedKey !== expectedHash) {
        // Redirect to unlock page (not API routes — those get 404)
        if (pathname.startsWith('/api/admin')) {
          return new NextResponse('Not Found', { status: 404 })
        }
        if (pathname !== '/admin/unlock') {
          return NextResponse.redirect(new URL('/admin/unlock', req.url))
        }
        return NextResponse.next()
      }
    }

    // Admin IP allowlist check
    const forwarded = req.headers.get('x-forwarded-for')
    const clientIp = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1'
    if (!isAdminIpAllowed(clientIp)) {
      return new NextResponse('Not Found', { status: 404 })
    }

    // Admin session bound to IP: if IP changes mid-session or missing, force re-auth
    if (!token?.adminIp || token.adminIp !== clientIp) {
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('reason', 'admin_ip_changed')
      return NextResponse.redirect(loginUrl)
    }

    // Also check TOTP for admin — require TOTP even if not globally enforced
    if (token?.requiresTotp) {
      return NextResponse.redirect(new URL('/totp', req.url))
    }

    // Admin inactivity auto-logout: check last activity time
    const adminTimeoutMinutes = parseInt(
      process.env.ADMIN_SESSION_TIMEOUT_MINUTES || '30',
      10
    )
    const lastActivity = (token?.lastActivity ?? token?.issuedAt) as number | undefined
    if (lastActivity) {
      const elapsed = Date.now() - lastActivity
      if (elapsed > adminTimeoutMinutes * 60 * 1000) {
        // Session expired — redirect to login for re-authentication
        const loginUrl = new URL('/login', req.url)
        loginUrl.searchParams.set('reason', 'admin_session_expired')
        return NextResponse.redirect(loginUrl)
      }
    }

    // CSRF protection for admin mutation endpoints (POST, PATCH, DELETE)
    if (pathname.startsWith('/api/admin')) {
      const method = req.method.toUpperCase()
      if (method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE') {
        const csrfHeader = req.headers.get('x-csrf-token')
        const csrfCookie = req.cookies.get('__keyhub_csrf')?.value
        if (csrfHeader && csrfCookie && csrfHeader === csrfCookie && !isCsrfTokenExpired(csrfCookie)) {
          // CSRF token is valid and not expired — proceed
        } else {
          if (!csrfCookie || isCsrfTokenExpired(csrfCookie)) {
            const csrfToken = generateCsrfToken()
            const response = NextResponse.json(
              { error: 'CSRF token missing or expired. Reload the page and try again.' },
              { status: 403 }
            )
            response.cookies.set('__keyhub_csrf', csrfToken, {
              httpOnly: false,
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production',
              path: '/',
              maxAge: CSRF_MAX_AGE_SECONDS,
            })
            return response
          }
          return NextResponse.json(
            { error: 'CSRF token mismatch' },
            { status: 403 }
          )
        }
      }
    }

    // For admin page requests (not API), ensure CSRF cookie exists and is fresh
    const adminCsrf = req.cookies.get('__keyhub_csrf')?.value
    if (!pathname.startsWith('/api/') && (!adminCsrf || isCsrfTokenExpired(adminCsrf))) {
      const csrfToken = generateCsrfToken()
      const response = NextResponse.next()
      response.cookies.set('__keyhub_csrf', csrfToken, {
        httpOnly: false,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: CSRF_MAX_AGE_SECONDS,
      })
      return response
    }

    return NextResponse.next()
  }

  // Handle TOTP challenge page
  if (isLoggedIn && token?.requiresTotp) {
    // User is logged in but needs TOTP verification
    if (isTotpPage) {
      // Ensure CSRF cookie is set for the TOTP page so the challenge POST works
      const totpCsrf = req.cookies.get('__keyhub_csrf')?.value
      if (!totpCsrf || isCsrfTokenExpired(totpCsrf)) {
        const csrfToken = generateCsrfToken()
        const response = NextResponse.next()
        response.cookies.set('__keyhub_csrf', csrfToken, {
          httpOnly: false,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: CSRF_MAX_AGE_SECONDS,
        })
        return response
      }
      return NextResponse.next()
    }
    // Redirect to TOTP challenge for all non-TOTP pages
    if (!isAuthPage) {
      return NextResponse.redirect(new URL('/totp', req.url))
    }
  }

  // If logged in and TOTP is complete, redirect away from TOTP page
  if (isLoggedIn && !token?.requiresTotp && isTotpPage) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // Impersonation read-only mode: block writes on non-admin routes unless ALLOW_IMPERSONATION_WRITES is set
  if (isLoggedIn && token?.impersonating && !isAdminRoute) {
    const method = req.method.toUpperCase()
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
      const allowWrites = process.env.ALLOW_IMPERSONATION_WRITES === 'true'
      if (!allowWrites) {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json(
            { error: 'Impersonation session is read-only' },
            { status: 403 }
          )
        }
        // For page navigations, just block
        return new NextResponse('Impersonation session is read-only', { status: 403 })
      }
    }
  }

  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  const isPublicPage = pathname === '/'
  if (!isLoggedIn && !isAuthPage && !isPublicPage) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // For page requests (not API), ensure CSRF cookie exists and is fresh
  const pageCsrf = req.cookies.get('__keyhub_csrf')?.value
  if (!pathname.startsWith('/api/') && (!pageCsrf || isCsrfTokenExpired(pageCsrf))) {
    const csrfToken = generateCsrfToken()
    const response = NextResponse.next()
    response.cookies.set('__keyhub_csrf', csrfToken, {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: CSRF_MAX_AGE_SECONDS,
    })
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/v1).*)'],
}
