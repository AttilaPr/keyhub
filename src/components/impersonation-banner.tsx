'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/fetch'
import { Button } from '@/components/ui/button'
import { LogoutIcon } from '@/components/ui/logout'
import { BadgeAlertIcon } from '@/components/ui/badge-alert'

interface ImpersonationData {
  targetEmail: string
  targetUserId: string
  adminId: string
}

export function ImpersonationBanner() {
  const router = useRouter()
  const [data, setData] = useState<ImpersonationData | null>(null)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    async function checkImpersonation() {
      try {
        const res = await fetch('/api/auth/session')
        const session = await res.json()
        if (session?.impersonating && session?.impersonatedBy) {
          setData({
            targetEmail: session.impersonating,
            targetUserId: session.user?.id ?? '',
            adminId: session.impersonatedBy,
          })
        }
      } catch {
        // Ignore errors
      }
    }
    checkImpersonation()
  }, [])

  if (!data) return null

  async function handleExit() {
    setExiting(true)
    try {
      const res = await apiFetch('/api/admin/impersonate/exit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (res.ok) {
        router.push('/admin/users')
      }
    } catch {
      // Force refresh on error
      router.refresh()
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
