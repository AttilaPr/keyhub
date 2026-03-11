import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = (session as any).activeOrgId ?? null
  const scope = orgId ? { orgId } : { userId: session.user.id, orgId: null }

  const count = await prisma.anomalyEvent.count({
    where: {
      ...scope,
      acknowledgedAt: null,
    },
  })

  return NextResponse.json({ count })
}
