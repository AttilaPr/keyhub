import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Missing verification token' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { emailVerifyToken: token },
    select: { id: true, emailVerified: true, createdAt: true, emailVerifyTokenCreatedAt: true },
  })

  if (!user) {
    return NextResponse.json({ error: 'Invalid or expired verification token' }, { status: 400 })
  }

  if (user.emailVerified) {
    // Already verified — redirect to login
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    return NextResponse.redirect(`${baseUrl}/login?verified=1`)
  }

  // Check token age (24 hour expiry) — use dedicated token timestamp if available, else createdAt
  const tokenCreatedAt = user.emailVerifyTokenCreatedAt ?? user.createdAt
  const tokenAge = Date.now() - tokenCreatedAt.getTime()
  if (tokenAge > 24 * 60 * 60 * 1000) {
    // Delete the expired unverified user so they can re-register
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {})
    return NextResponse.json({ error: 'Verification link has expired. Please register again.' }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, emailVerifyToken: null },
  })

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  return NextResponse.redirect(`${baseUrl}/login?verified=1`)
}
