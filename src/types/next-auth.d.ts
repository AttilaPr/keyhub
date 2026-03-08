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
  }
}
