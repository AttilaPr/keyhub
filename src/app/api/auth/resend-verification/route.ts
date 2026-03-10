import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { randomBytes } from 'crypto'
import { sendEmail } from '@/lib/email'
import { emailVerificationEmail } from '@/lib/email-templates'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(req: Request) {
  // Rate limit by IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'
  const rl = await checkRateLimit(`resend_verify:${ip}`, {
    maxAttempts: 3,
    windowMs: 15 * 60 * 1000, // 3 per 15 min per IP
  })
  if (!rl.allowed) {
    // Return success-like response even when rate limited to prevent enumeration
    return NextResponse.json({ message: 'If an unverified account exists, a verification email has been sent.' })
  }

  let email: string
  try {
    const body = await req.json()
    email = body.email
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email required' }, { status: 400 })
  }

  email = email.toLowerCase().trim()

  // Always return the same message to prevent user enumeration
  const successMessage = { message: 'If an unverified account exists, a verification email has been sent.' }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, emailVerified: true },
  })

  if (!user || user.emailVerified) {
    return NextResponse.json(successMessage)
  }

  // Generate new token and reset the expiry window by updating createdAt-based tracking
  const emailVerifyToken = randomBytes(32).toString('hex')
  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerifyToken, emailVerifyTokenCreatedAt: new Date() },
  })

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${emailVerifyToken}`
  sendEmail(
    email,
    'Verify your email — KeyHub',
    emailVerificationEmail(user.name || email, verifyUrl),
  ).catch((err) => console.error('[resend-verification] Failed to send email:', err))

  return NextResponse.json(successMessage)
}
