import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      role: string
    }
    requiresTotp?: boolean
    activeOrgId?: string        // currently selected organization context
    impersonating?: string      // target user email
    impersonatedBy?: string     // admin user ID
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: string
    requiresTotp?: boolean
    activeOrgId?: string        // currently selected organization context
    impersonating?: string      // target user email
    impersonatedBy?: string     // admin user ID
    originalAdminId?: string    // preserved admin session ID
    originalAdminRole?: string  // preserved admin role
    adminIp?: string            // IP address when admin session was created
    issuedAt?: number           // JWT issue timestamp
    lastDbCheck?: number        // last time user data was re-checked from DB
    lastActivity?: number       // last activity timestamp for session timeout
    invalidated?: boolean       // whether the session has been invalidated
  }
}
