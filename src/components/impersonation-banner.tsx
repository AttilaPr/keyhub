'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { LogoutIcon } from '@/components/ui/logout'
import { BadgeAlertIcon } from '@/components/ui/badge-alert'

interface ImpersonationData {
  targetEmail: string
  targetUserId: string
  adminId: string
}

export function ImpersonationBanner() {
  const [data, setData] = useState<ImpersonationData | null>(null)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    // Check session for impersonation fields
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((session) => {
        if (session?.impersonating && session?.impersonatedBy) {
          setData({
            targetEmail: session.impersonating,
            targetUserId: session.user?.id ?? '',
            adminId: session.impersonatedBy,
          })
        }
      })
      .catch(() => {
        // Ignore errors
      })
  }, [])

  if (!data) return null

  async function handleExit() {
    setExiting(true)
    try {
      const res = await fetch('/api/admin/impersonate/exit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (res.ok) {
        window.location.href = '/admin/users'
      }
    } catch {
      // Force reload on error
      window.location.reload()
    } finally {
      setExiting(false)
    }
  }

  return (
    <div className="flex items-center justify-center gap-3 bg-amber-500/15 border-b border-amber-500/30 px-4 py-2">
      <BadgeAlertIcon size={16} className="text-amber-400 shrink-0" />
      <span className="text-sm text-amber-200">
        You are viewing as <strong className="text-amber-100">{data.targetEmail}</strong>
      </span>
      <Button
        variant="outline"
        size="xs"
        onClick={handleExit}
        disabled={exiting}
        className="border-amber-500/50 text-amber-200 hover:bg-amber-500/20 hover:text-amber-100"
      >
        <LogoutIcon size={12} className="mr-1" />
        {exiting ? 'Exiting...' : 'Exit impersonation'}
      </Button>
    </div>
  )
}
