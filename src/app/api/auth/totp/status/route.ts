import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { totpEnabled: true },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Count remaining backup codes
  const remainingBackupCodes = await prisma.totpBackupCode.count({
    where: {
      userId: session.user.id,
      usedAt: null,
    },
  })

  return NextResponse.json({
    totpEnabled: user.totpEnabled,
    remainingBackupCodes,
  })
}
