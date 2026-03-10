import { NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import prisma from '@/lib/prisma'
import { randomBytes } from 'crypto'
import { sendEmail } from '@/lib/email'
import { emailVerificationEmail } from '@/lib/email-templates'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(req: Request) {
  try {
    // Rate limit registration by IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'
    const rl = await checkRateLimit(`register:${ip}`, {
      maxAttempts: 5,
      windowMs: 60 * 60 * 1000, // 5 per hour per IP
    })
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many registration attempts. Try again later.' }, { status: 429 })
    }

    const { email: rawEmail, password, name } = await req.json()

    if (!rawEmail || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    // Normalize email
    const email = rawEmail.toLowerCase().trim()

    // Basic email format validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    if (password.length > 128) {
      return NextResponse.json({ error: 'Password must not exceed 128 characters' }, { status: 400 })
    }

    // Validate name length
    const safeName = name ? String(name).slice(0, 200) : null

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      // Return same response as success to prevent user enumeration
      return NextResponse.json({ message: 'If this email is not registered, a verification email has been sent.' }, { status: 201 })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const emailVerifyToken = randomBytes(32).toString('hex')

    try {
      await prisma.user.create({
        data: {
          email,
          passwordHash,
          name: safeName,
          emailVerifyToken,
          emailVerified: false,
        },
      })
    } catch (err: unknown) {
      // Handle race condition: concurrent registration with same email
      if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
        return NextResponse.json({ message: 'If this email is not registered, a verification email has been sent.' }, { status: 201 })
      }
      throw err
    }

    // Send verification email
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${emailVerifyToken}`
    sendEmail(
      email,
      'Verify your email — KeyHub',
      emailVerificationEmail(safeName || email, verifyUrl),
    ).catch((err) => console.error('[register] Failed to send verification email:', err))

    return NextResponse.json({ message: 'If this email is not registered, a verification email has been sent.' }, { status: 201 })
  } catch (error) {
    console.error('[register] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
