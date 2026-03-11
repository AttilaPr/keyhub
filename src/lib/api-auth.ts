import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { verifyPlatformKey } from '@/lib/platform-key'

/**
 * Authenticate an API request via either:
 *   1. NextAuth session (browser cookie) — used by the web UI
 *   2. Platform API key (Authorization: Bearer ak-user-...) — used by MCP server / external tools
 *
 * Returns the userId if authenticated, or null if not.
 */
export async function resolveUserId(req: Request): Promise<string | null> {
  // 1. Try session auth first (fast path for browser requests)
  const session = await auth()
  if (session?.user?.id) return session.user.id

  // 2. Fall back to platform API key from Authorization header
  const header = req.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return null

  const rawKey = header.slice(7)
  if (!rawKey.startsWith('ak-')) return null

  const prefix = rawKey.slice(0, 16)

  const candidates = await prisma.platformKey.findMany({
    where: { keyPrefix: prefix, isActive: true, revokedAt: null },
    select: { id: true, userId: true, keyHash: true, expiresAt: true },
  })

  for (const key of candidates) {
    // Skip expired keys
    if (key.expiresAt && key.expiresAt < new Date()) continue

    const valid = await verifyPlatformKey(rawKey, key.keyHash)
    if (valid) return key.userId
  }

  return null
}
