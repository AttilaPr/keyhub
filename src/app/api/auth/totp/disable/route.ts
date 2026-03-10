import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { decryptKey } from '@/lib/encryption'
import { verifyTotpCode } from '@/lib/totp'
import bcrypt from 'bcrypt'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { password, code } = body

  if (!password || typeof password !== 'string') {
    return NextResponse.json(
      { error: 'Current password is required' },
      { status: 400 }
    )
  }

  if (!code || typeof code !== 'string' || code.length !== 6) {
    return NextResponse.json(
      { error: 'A 6-digit TOTP code is required' },
      { status: 400 }
    )
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      passwordHash: true,
      totpSecret: true,
      totpEnabled: true,
    },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (!user.totpEnabled || !user.totpSecret) {
    return NextResponse.json(
      { error: 'MFA is not enabled' },
      { status: 400 }
    )
  }

  // Verify password
  const passwordMatch = await bcrypt.compare(password, user.passwordHash)
  if (!passwordMatch) {
    return NextResponse.json(
      { error: 'Incorrect password' },
      { status: 400 }
    )
  }

  // Verify TOTP code
  const secret = decryptKey(user.totpSecret)
  const isValid = verifyTotpCode(secret, code)
  if (!isValid) {
    return NextResponse.json(
      { error: 'Invalid TOTP code' },
      { status: 400 }
    )
  }

  // Disable MFA: clear secret, disable flag, delete backup codes
  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.user.id },
      data: {
        totpEnabled: false,
        totpSecret: null,
        totpFailedAttempts: 0,
        totpLockedUntil: null,
      },
    }),
    prisma.totpBackupCode.deleteMany({
      where: { userId: session.user.id },
    }),
  ])

  // Audit log
  await prisma.auditEvent.create({
    data: {
      actorId: session.user.id,
      action: 'totp.disabled',
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: req.headers.get('user-agent') ?? null,
    },
  }).catch(() => {})

  return NextResponse.json({ success: true })
}
