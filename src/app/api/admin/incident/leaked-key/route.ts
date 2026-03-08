import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin'
import { logAuditEvent, getRequestMeta } from '@/lib/audit'
import prisma from '@/lib/prisma'

export async function POST(req: Request) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { keyPrefix } = await req.json()
  if (!keyPrefix || typeof keyPrefix !== 'string' || keyPrefix.trim().length < 3) {
    return NextResponse.json({ error: 'Key prefix must be at least 3 characters' }, { status: 400 })
  }

  const prefix = keyPrefix.trim()

  // Find all platform keys matching the prefix
  const matchingKeys = await prisma.platformKey.findMany({
    where: { keyPrefix: { startsWith: prefix } },
    include: { user: { select: { email: true, name: true } } },
  })

  if (matchingKeys.length === 0) {
    return NextResponse.json({ error: 'No keys found matching that prefix' }, { status: 404 })
  }

  const meta = getRequestMeta(req)

  // Disable all matching keys
  const affectedKeys = []
  for (const key of matchingKeys) {
    await prisma.platformKey.update({
      where: { id: key.id },
      data: { isActive: false, revokedAt: new Date() },
    })

    await logAuditEvent({
      actorId: session.user.id,
      userId: key.userId,
      action: 'admin.incident.leaked_key',
      targetType: 'PlatformKey',
      targetId: key.id,
      metadata: {
        keyPrefix: key.keyPrefix,
        label: key.label,
        ownerEmail: key.user.email,
        searchedPrefix: prefix,
      },
      ...meta,
    })

    affectedKeys.push({
      id: key.id,
      keyPrefix: key.keyPrefix,
      label: key.label,
      ownerEmail: key.user.email,
      ownerName: key.user.name,
      wasActive: key.isActive,
    })
  }

  return NextResponse.json({
    success: true,
    affectedCount: affectedKeys.length,
    affectedKeys,
  })
}
