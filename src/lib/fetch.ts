/**
 * Client-side fetch wrapper that automatically attaches the CSRF token header.
 * Use this for all POST/PATCH/PUT/DELETE requests to /api/* routes.
 */

function getCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)__keyhub_csrf=([^;]+)/)
  return match ? match[1] : null
}

export function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase()

  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    const csrfToken = getCsrfToken()
    if (csrfToken) {
      const headers = new Headers(options.headers)
      headers.set('x-csrf-token', csrfToken)
      options.headers = headers
    }
  }

  return fetch(url, options)
}
