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

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow public routes through
  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/v1') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const isLoggedIn = !!token
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register')
  const isTotpPage = pathname === '/totp'
  const isAdminRoute = pathname.startsWith('/admin') || pathname.startsWith('/api/admin')

  // Admin routes: return 404 for non-admins to hide the panel's existence
  if (isAdminRoute) {
    if (!isLoggedIn || token?.role !== 'SUPER_ADMIN') {
      return new NextResponse('Not Found', { status: 404 })
    }

    // Admin IP allowlist check
    const forwarded = req.headers.get('x-forwarded-for')
    const clientIp = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1'
    if (!isAdminIpAllowed(clientIp)) {
      return new NextResponse('Not Found', { status: 404 })
    }

    // Admin session bound to IP: if IP changes mid-session, force re-auth
    if (token?.adminIp && token.adminIp !== clientIp) {
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('reason', 'admin_ip_changed')
      return NextResponse.redirect(loginUrl)
    }

    // Also check TOTP for admin — require TOTP even if not globally enforced
    if (token?.requiresTotp) {
      return NextResponse.redirect(new URL('/totp', req.url))
    }

    // Admin inactivity auto-logout: check if JWT was issued too long ago
    const adminTimeoutMinutes = parseInt(
      process.env.ADMIN_SESSION_TIMEOUT_MINUTES || '30',
      10
    )
    const issuedAt = token?.issuedAt as number | undefined
    if (issuedAt) {
      const elapsed = Date.now() - issuedAt
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
      if (method === 'POST' || method === 'PATCH' || method === 'DELETE') {
        const csrfHeader = req.headers.get('x-csrf-token')
        const csrfCookie = req.cookies.get('__keyhub_csrf')?.value
        if (csrfHeader && csrfCookie && csrfHeader === csrfCookie) {
          // CSRF token is valid — proceed
        } else if (!csrfHeader && !csrfCookie) {
          // No CSRF tokens set yet (first admin visit) — allow through
          // The admin layout will set the cookie on page load
        } else if (csrfHeader && csrfCookie && csrfHeader !== csrfCookie) {
          return NextResponse.json(
            { error: 'CSRF token mismatch' },
            { status: 403 }
          )
        }
      }
    }

    // For admin page requests (not API), ensure CSRF cookie exists
    if (!pathname.startsWith('/api/') && !req.cookies.get('__keyhub_csrf')?.value) {
      const bytes = new Uint8Array(32)
      crypto.getRandomValues(bytes)
      const csrfToken = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
      const response = NextResponse.next()
      response.cookies.set('__keyhub_csrf', csrfToken, {
        httpOnly: false,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60,
      })
      return response
    }

    return NextResponse.next()
  }

  // Handle TOTP challenge page
  if (isLoggedIn && token?.requiresTotp) {
    // User is logged in but needs TOTP verification
    if (isTotpPage) {
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

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/v1).*)'],
}
