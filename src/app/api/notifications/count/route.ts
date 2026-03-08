import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const count = await prisma.anomalyEvent.count({
    where: {
      userId: session.user.id,
      acknowledgedAt: null,
    },
  })

  return NextResponse.json({ count })
}
