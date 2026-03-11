import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = (session as any).activeOrgId ?? null
  const scope = orgId ? { orgId } : { userId: session.user.id, orgId: null }

  const [providerKeyCount, platformKeyCount, requestCount] = await Promise.all([
    prisma.providerKey.count({ where: { ...scope, isActive: true } }),
    prisma.platformKey.count({ where: { ...scope } }),
    prisma.requestLog.count({ where: { ...scope } }),
  ])

  return NextResponse.json({
    providerKeyCount,
    platformKeyCount,
    requestCount,
  })
}
