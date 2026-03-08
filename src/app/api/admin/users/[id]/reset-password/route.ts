import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin'
import prisma from '@/lib/prisma'
import bcrypt from 'bcrypt'
import crypto from 'crypto'
import { sendEmail } from '@/lib/email'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { id: userId } = await params

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Generate a secure random temporary password
  const tempPassword = crypto.randomBytes(12).toString('base64url').slice(0, 16)

  // Hash the temporary password
  const passwordHash = await bcrypt.hash(tempPassword, 12)

  // Update user's password
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      // Invalidate existing sessions
      sessionInvalidatedAt: new Date(),
    },
  })

  // Send email with temporary password
  const appUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://keyhub.dev'
  await sendEmail(
    user.email,
    'KeyHub — Your password has been reset',
    `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #e4e4e7;">
      <h2 style="color: #a3e635;">Password Reset</h2>
      <p>Hi ${user.name || 'there'},</p>
      <p>Your KeyHub password has been reset by an administrator. Use the temporary password below to log in:</p>
      <div style="background: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 16px; margin: 16px 0; text-align: center;">
        <code style="font-size: 18px; letter-spacing: 2px; color: #a3e635;">${tempPassword}</code>
      </div>
      <p><strong>Please change your password immediately after logging in.</strong></p>
      <p>
        <a href="${appUrl}/login" style="color: #a3e635; text-decoration: underline;">Log in to KeyHub</a>
      </p>
      <hr style="border: none; border-top: 1px solid #27272a; margin: 24px 0;" />
      <p style="font-size: 12px; color: #71717a;">
        If you did not expect this email, please contact your administrator.
      </p>
    </div>
    `.trim()
  )

  // Log audit event
  await prisma.auditEvent.create({
    data: {
      actorId: session.user.id,
      userId: userId,
      action: 'admin.user.password_reset',
      targetType: 'User',
      targetId: userId,
      metadata: JSON.stringify({
        userEmail: user.email,
        resetBy: session.user.email,
      }),
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: req.headers.get('user-agent') ?? null,
    },
  })

  return NextResponse.json({
    success: true,
    message: `Password reset email sent to ${user.email}`,
  })
}
