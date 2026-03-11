import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { verifyPlatformKey } from '@/lib/platform-key'

export interface ApiContext {
  userId: string
  /** When set, the user is viewing an org — queries should scope to this orgId. */
  orgId: string | null
}

/**
 * Authenticate an API request via either:
 *   1. NextAuth session (browser cookie) — used by the web UI
 *   2. Platform API key (Authorization: Bearer ak-user-...) — used by MCP server / external tools
 *
 * Returns { userId, orgId } if authenticated, or null if not.
 *
 * orgId comes from:
 *   - Session: session.activeOrgId (set by the sidebar org switcher)
 *   - Platform key: the key's own orgId field
 *
 * When orgId is null, the user is in their personal workspace.
 */
export async function resolveContext(req: Request): Promise<ApiContext | null> {
  // 1. Try session auth first (fast path for browser requests)
  const session = await auth()
  if (session?.user?.id) {
    const orgId = (session as any).activeOrgId ?? null
    return { userId: session.user.id, orgId }
  }

  // 2. Fall back to platform API key from Authorization header
  const header = req.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return null

  const rawKey = header.slice(7)
  if (!rawKey.startsWith('ak-')) return null

  const prefix = rawKey.slice(0, 16)

  const candidates = await prisma.platformKey.findMany({
    where: { keyPrefix: prefix, isActive: true, revokedAt: null },
    select: { id: true, userId: true, orgId: true, keyHash: true, expiresAt: true },
  })

  for (const key of candidates) {
    // Skip expired keys
    if (key.expiresAt && key.expiresAt < new Date()) continue

    const valid = await verifyPlatformKey(rawKey, key.keyHash)
    if (valid) return { userId: key.userId, orgId: key.orgId }
  }

  return null
}

/**
 * Convenience wrapper — returns just the userId (backwards compatible).
 */
export async function resolveUserId(req: Request): Promise<string | null> {
  const ctx = await resolveContext(req)
  return ctx?.userId ?? null
}

/**
 * Build a Prisma `where` filter scoped to the current context.
 *
 * - Personal workspace (orgId=null): { userId, orgId: null }
 * - Org workspace (orgId=xxx):       { orgId }
 *
 * In org mode, we filter by orgId only — all org members share the data.
 */
export function scopeWhere(ctx: ApiContext): { userId?: string; orgId?: string | null } {
  if (ctx.orgId) {
    return { orgId: ctx.orgId }
  }
  return { userId: ctx.userId, orgId: null }
}
