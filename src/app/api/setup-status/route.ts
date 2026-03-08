import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  const [providerKeyCount, platformKeyCount, requestCount] = await Promise.all([
    prisma.providerKey.count({ where: { userId, isActive: true } }),
    prisma.platformKey.count({ where: { userId } }),
    prisma.requestLog.count({ where: { userId } }),
  ])

  return NextResponse.json({
    providerKeyCount,
    platformKeyCount,
    requestCount,
  })
}
