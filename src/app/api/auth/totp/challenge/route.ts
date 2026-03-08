import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { encode, getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { decryptKey } from '@/lib/encryption'
import { verifyTotpCode } from '@/lib/totp'
import bcrypt from 'bcrypt'

const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15 minutes
const MAX_ATTEMPTS = 5

export async function POST(req: Request) {
  // Get the token from the request (it should have requiresTotp: true)
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

  if (!token?.id || !token?.requiresTotp) {
    return NextResponse.json(
      { error: 'No pending TOTP challenge' },
      { status: 401 }
    )
  }

  const userId = token.id as string

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      totpSecret: true,
      totpEnabled: true,
      totpFailedAttempts: true,
      totpLockedUntil: true,
    },
  })

  if (!user || !user.totpEnabled || !user.totpSecret) {
    return NextResponse.json(
      { error: 'MFA is not configured' },
      { status: 400 }
    )
  }

  // Check rate limiting lockout
  if (user.totpLockedUntil && user.totpLockedUntil > new Date()) {
    const remainingMs = user.totpLockedUntil.getTime() - Date.now()
    const remainingMin = Math.ceil(remainingMs / 60000)
    return NextResponse.json(
      { error: `Too many failed attempts. Try again in ${remainingMin} minute${remainingMin > 1 ? 's' : ''}.` },
      { status: 429 }
    )
  }

  const body = await req.json()
  const { code, isBackupCode } = body

  if (!code || typeof code !== 'string') {
    return NextResponse.json(
      { error: 'A code is required' },
      { status: 400 }
    )
  }

  let isValid = false

  if (isBackupCode) {
    // Try to match against unused backup codes
    const backupCodes = await prisma.totpBackupCode.findMany({
      where: { userId, usedAt: null },
    })

    for (const bc of backupCodes) {
      const match = await bcrypt.compare(code.toLowerCase().trim(), bc.codeHash)
      if (match) {
        // Mark as used
        await prisma.totpBackupCode.update({
          where: { id: bc.id },
          data: { usedAt: new Date() },
        })
        isValid = true
        break
      }
    }
  } else {
    // Verify TOTP code
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: 'TOTP code must be 6 digits' },
        { status: 400 }
      )
    }
    const secret = decryptKey(user.totpSecret)
    isValid = verifyTotpCode(secret, code)
  }

  if (!isValid) {
    // Increment failure count
    const newAttempts = (user.totpFailedAttempts || 0) + 1
    const updateData: { totpFailedAttempts: number; totpLockedUntil?: Date } = {
      totpFailedAttempts: newAttempts,
    }

    if (newAttempts >= MAX_ATTEMPTS) {
      updateData.totpLockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS)
    }

    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    })

    const remaining = MAX_ATTEMPTS - newAttempts
    if (remaining <= 0) {
      return NextResponse.json(
        { error: 'Too many failed attempts. Account locked for 15 minutes.' },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { error: `Invalid code. ${remaining} attempt${remaining > 1 ? 's' : ''} remaining.` },
      { status: 400 }
    )
  }

  // Success: reset failure counter
  await prisma.user.update({
    where: { id: userId },
    data: {
      totpFailedAttempts: 0,
      totpLockedUntil: null,
    },
  })

  // Update the JWT to remove requiresTotp flag
  const newToken = {
    ...token,
    requiresTotp: false,
  }

  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Server config error' }, { status: 500 })
  }

  const isSecure = process.env.NODE_ENV === 'production'
  const cookieName = isSecure
    ? '__Secure-authjs.session-token'
    : 'authjs.session-token'

  const encoded = await encode({
    token: newToken,
    secret,
    salt: cookieName,
  })

  // Set the session cookie with the updated token
  const cookieStore = await cookies()

  cookieStore.set(cookieName, encoded, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  })

  return NextResponse.json({ success: true })
}
