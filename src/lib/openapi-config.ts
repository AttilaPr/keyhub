/**
 * OpenAPI specification configuration.
 *
 * Defines which routes should be excluded from the public OpenAPI spec.
 * Admin routes must never be documented externally.
 */

export const EXCLUDED_ROUTES: string[] = [
  '/api/admin/*',
  '/api/admin/users/*',
  '/api/admin/orgs/*',
  '/api/admin/logs/*',
  '/api/admin/finance/*',
  '/api/admin/pricing/*',
  '/api/admin/plans/*',
  '/api/admin/flags/*',
  '/api/admin/system/*',
  '/api/admin/announcements/*',
  '/api/admin/audit/*',
  '/api/admin/impersonate/*',
  '/api/admin/incident/*',
  '/api/admin/provider-keys/*',
  '/api/admin/platform-keys/*',
  '/api/admin/dashboard/*',
]

/**
 * Check whether a given API path should be excluded from the public OpenAPI spec.
 * Uses simple glob-style matching where `*` matches any suffix.
 */
export function isExcludedFromOpenApi(path: string): boolean {
  return EXCLUDED_ROUTES.some((pattern) => {
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -2)
      return path === prefix || path.startsWith(prefix + '/')
    }
    return path === pattern
  })
}
