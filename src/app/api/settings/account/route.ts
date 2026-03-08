import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import bcrypt from 'bcrypt'

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { password } = await req.json()

  if (!password) {
    return NextResponse.json({ error: 'Password is required' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: 'Password is incorrect' }, { status: 403 })
  }

  // Delete in order to respect FK constraints:
  // RequestLog references PlatformKey and ProviderKey (no cascade)
  // UsageSummary references User (no cascade)
  // Then delete User (cascades to ProviderKey and PlatformKey)
  await prisma.$transaction([
    prisma.requestLog.deleteMany({ where: { userId: session.user.id } }),
    prisma.usageSummary.deleteMany({ where: { userId: session.user.id } }),
    prisma.user.delete({ where: { id: session.user.id } }),
  ])

  return NextResponse.json({ success: true })
}
