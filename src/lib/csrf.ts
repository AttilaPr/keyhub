import { randomBytes } from 'crypto'
import { cookies } from 'next/headers'

const CSRF_COOKIE_NAME = '__keyhub_csrf'
const CSRF_HEADER_NAME = 'x-csrf-token'

/**
 * Generate a random CSRF token string.
 */
export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Set a CSRF token cookie and return the token value.
 * Call this when rendering admin pages so the client can read
 * the cookie value and send it back in the X-CSRF-Token header.
 */
export async function setCsrfCookie(): Promise<string> {
  const token = generateCsrfToken()
  const cookieStore = await cookies()
  cookieStore.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Client JS needs to read this to send in header
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60, // 1 hour
  })
  return token
}

/**
 * Validate that the CSRF token in the request header matches the cookie.
 * Returns true if valid, false otherwise.
 */
export async function validateCsrfToken(req: Request): Promise<boolean> {
  const headerToken = req.headers.get(CSRF_HEADER_NAME)
  if (!headerToken) return false

  const cookieStore = await cookies()
  const cookieToken = cookieStore.get(CSRF_COOKIE_NAME)?.value
  if (!cookieToken) return false

  // Constant-time comparison to prevent timing attacks
  if (headerToken.length !== cookieToken.length) return false

  let result = 0
  for (let i = 0; i < headerToken.length; i++) {
    result |= headerToken.charCodeAt(i) ^ cookieToken.charCodeAt(i)
  }
  return result === 0
}

export { CSRF_COOKIE_NAME, CSRF_HEADER_NAME }
