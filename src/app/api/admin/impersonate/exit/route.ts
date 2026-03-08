import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { logAuditEvent, getRequestMeta } from '@/lib/audit'
import { dispatchWebhook } from '@/lib/webhooks'
import { encode } from 'next-auth/jwt'
import { cookies } from 'next/headers'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (!session.impersonatedBy) {
    return NextResponse.json({ error: 'Not currently impersonating' }, { status: 400 })
  }

  const adminId = session.impersonatedBy

  // Fetch the admin user to restore session
  const admin = await prisma.user.findUnique({
    where: { id: adminId },
    select: { id: true, email: true, name: true, role: true },
  })

  if (!admin || admin.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Admin session could not be restored' }, { status: 400 })
  }

  // Restore admin session
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const cookieStore = await cookies()
  const isSecure = process.env.NEXTAUTH_URL?.startsWith('https') ?? false
  const cookieName = isSecure
    ? '__Secure-authjs.session-token'
    : 'authjs.session-token'

  const token = await encode({
    token: {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      issuedAt: Date.now(),
    },
    secret,
    salt: cookieName,
    maxAge: 24 * 60 * 60,
  } as Parameters<typeof encode>[0])

  cookieStore.set(cookieName, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 24 * 60 * 60,
  })

  const meta = getRequestMeta(req)
  await logAuditEvent({
    actorId: adminId,
    userId: session.user.id,
    action: 'admin.impersonation.ended',
    targetType: 'User',
    targetId: session.user.id,
    metadata: {
      targetEmail: session.user.email,
      adminEmail: admin.email,
    },
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  // Dispatch webhook event for impersonation end
  dispatchWebhook(session.user.id, 'admin.impersonation.ended', {
    adminId: adminId,
    adminEmail: admin.email,
    targetUserId: session.user.id,
    targetEmail: session.user.email,
    timestamp: new Date().toISOString(),
  }).catch(() => {})

  return NextResponse.json({ success: true, redirectTo: '/admin/users' })
}
