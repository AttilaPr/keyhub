import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { decryptKey } from '@/lib/encryption'
import { verifyTotpCode, generateBackupCodes } from '@/lib/totp'
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
  const { code, password } = body

  if (!code || typeof code !== 'string' || code.length !== 6) {
    return NextResponse.json(
      { error: 'A 6-digit TOTP code is required' },
      { status: 400 }
    )
  }

  if (!password || typeof password !== 'string') {
    return NextResponse.json(
      { error: 'Password is required to enable MFA' },
      { status: 400 }
    )
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { totpSecret: true, totpEnabled: true, passwordHash: true },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Verify password before enabling TOTP
  const passwordMatch = await bcrypt.compare(password, user.passwordHash)
  if (!passwordMatch) {
    return NextResponse.json(
      { error: 'Invalid password' },
      { status: 403 }
    )
  }

  if (user.totpEnabled) {
    return NextResponse.json(
      { error: 'MFA is already enabled' },
      { status: 400 }
    )
  }

  if (!user.totpSecret) {
    return NextResponse.json(
      { error: 'No TOTP secret found. Call /api/auth/totp/setup first.' },
      { status: 400 }
    )
  }

  // Decrypt the stored secret
  const secret = decryptKey(user.totpSecret)

  // Verify the code
  const isValid = verifyTotpCode(secret, code)
  if (!isValid) {
    return NextResponse.json(
      { error: 'Invalid TOTP code. Please try again.' },
      { status: 400 }
    )
  }

  // Generate backup codes
  const plainCodes = generateBackupCodes(10)

  // Hash each backup code
  const hashedCodes = await Promise.all(
    plainCodes.map(async (c) => ({
      codeHash: await bcrypt.hash(c, 10),
      userId: session.user.id,
    }))
  )

  // Enable TOTP and store backup codes in a transaction
  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.user.id },
      data: { totpEnabled: true },
    }),
    // Delete any existing backup codes (shouldn't exist, but just in case)
    prisma.totpBackupCode.deleteMany({
      where: { userId: session.user.id },
    }),
    // Create new backup codes
    prisma.totpBackupCode.createMany({
      data: hashedCodes,
    }),
  ])

  // Audit log
  await prisma.auditEvent.create({
    data: {
      actorId: session.user.id,
      action: 'totp.enabled',
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: req.headers.get('user-agent') ?? null,
    },
  }).catch(() => {})

  return NextResponse.json({
    backupCodes: plainCodes,
  })
}
