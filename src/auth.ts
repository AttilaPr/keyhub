import NextAuth, { CredentialsSignin } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'

class EmailNotVerifiedError extends CredentialsSignin {
  code = 'email_not_verified'
}
import bcrypt from 'bcrypt'
import prisma from '@/lib/prisma'
import { headers } from 'next/headers'
import { checkRateLimit } from '@/lib/rate-limit'

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const email = (credentials.email as string).toLowerCase()

        // Database-backed rate limit check (works across Vercel instances)
        // Only checks if blocked — does NOT increment on every attempt
        const rlKey = `login:${email}`
        const rl = await checkRateLimit(rlKey, {
          maxAttempts: 5,
          windowMs: 15 * 60 * 1000, // 15 minutes
          checkOnly: true,
        })
        if (!rl.allowed) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true, email: true, name: true, role: true,
            passwordHash: true, suspended: true, emailVerified: true,
            totpEnabled: true,
          },
        })

        if (!user) {
          // Count as failed attempt
          await checkRateLimit(rlKey, { maxAttempts: 5, windowMs: 15 * 60 * 1000 }).catch(() => {})
          return null
        }

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        )

        if (!passwordMatch) {
          // Count as failed attempt
          await checkRateLimit(rlKey, { maxAttempts: 5, windowMs: 15 * 60 * 1000 }).catch(() => {})
          return null
        }

        // Block suspended users from logging in
        if (user.suspended) return null

        // Block unverified email
        if (!user.emailVerified) throw new EmailNotVerifiedError()

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          requiresTotp: user.totpEnabled,
        }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string
        token.role = (user as any).role ?? 'USER'
        token.issuedAt = Date.now()
        // Set TOTP requirement flag from authorize
        if ((user as any).requiresTotp) {
          token.requiresTotp = true
        }
        // Capture IP at login for admin session binding
        if ((user as any).role === 'SUPER_ADMIN') {
          try {
            const hdrs = await headers()
            const forwarded = hdrs.get('x-forwarded-for')
            token.adminIp = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1'
          } catch {
            token.adminIp = '127.0.0.1'
          }
        }
      }
      // Handle org switch via session update trigger
      if (trigger === 'update' && session?.activeOrgId !== undefined) {
        token.activeOrgId = session.activeOrgId || undefined
      }
      // Check for session invalidation and suspension periodically (every 60s)
      // to avoid a DB query on every single request
      const DB_CHECK_INTERVAL_MS = 60 * 1000 // 60 seconds
      const lastDbCheck = (token.lastDbCheck as number) || 0
      if (token.id && (Date.now() - lastDbCheck > DB_CHECK_INTERVAL_MS)) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { name: true, role: true, suspended: true, sessionInvalidatedAt: true },
        })
        if (dbUser) {
          // If user is suspended, invalidate session
          if (dbUser.suspended) {
            return { ...token, invalidated: true }
          }
          // If session was invalidated after this token was issued, reject it
          if (dbUser.sessionInvalidatedAt && token.issuedAt) {
            const invalidatedTime = new Date(dbUser.sessionInvalidatedAt).getTime()
            if (invalidatedTime > (token.issuedAt as number)) {
              return { ...token, invalidated: true }
            }
          }
          token.name = dbUser.name
          token.role = dbUser.role
        }
        token.lastDbCheck = Date.now()
      }
      // Track last activity for admin session timeout
      if (token.role === 'SUPER_ADMIN') {
        token.lastActivity = Date.now()
      }
      return token
    },
    async session({ session, token }) {
      // If the token has been invalidated (suspended user or force logout),
      // return an empty session to force re-login
      if (token.invalidated) {
        return { ...session, user: undefined } as any
      }
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        ;(session as any).requiresTotp = token.requiresTotp === true
      }
      // Propagate active org context to session
      if (token.activeOrgId) {
        session.activeOrgId = token.activeOrgId as string
      }
      // Propagate impersonation fields to session
      if (token.impersonating) {
        session.impersonating = token.impersonating as string
      }
      if (token.impersonatedBy) {
        session.impersonatedBy = token.impersonatedBy as string
      }
      return session
    },
  },
})
