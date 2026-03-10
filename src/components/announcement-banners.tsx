'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { apiFetch } from '@/lib/fetch'

interface Announcement {
  id: string
  title: string
  body: string
  type: string
  targetRole: string
  publishedAt: string
  expiresAt: string | null
}

const typeStyles: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  info: {
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    text: 'text-cyan-600 dark:text-cyan-300',
    icon: 'text-cyan-600 dark:text-cyan-400 hover:text-cyan-200',
  },
  warning: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    text: 'text-amber-300',
    icon: 'text-amber-400 hover:text-amber-200',
  },
  critical: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    text: 'text-red-300',
    icon: 'text-red-400 hover:text-red-200',
  },
}

export function AnnouncementBanners() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])

  useEffect(() => {
    fetch('/api/announcements')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load announcements')
        return res.json()
      })
      .then((data) => setAnnouncements(data.announcements || []))
      .catch(() => {
        // Silently fail - banners are non-critical
      })
  }, [])

  async function handleDismiss(announcementId: string) {
    setAnnouncements((prev) => prev.filter((a) => a.id !== announcementId))
    try {
      await apiFetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss', announcementId }),
      })
    } catch {
      // Dismissal is best-effort
    }
  }

  if (announcements.length === 0) return null

  return (
    <div className="flex flex-col">
      {announcements.map((announcement) => {
        const styles = typeStyles[announcement.type] || typeStyles.info
        return (
          <div
            key={announcement.id}
            className={`flex items-center gap-3 border-b px-4 py-2.5 ${styles.bg} ${styles.border}`}
          >
            <div className={`flex-1 text-sm ${styles.text}`}>
              <span className="font-semibold">{announcement.title}</span>
              {announcement.body && (
                <span className="ml-2 opacity-80">{announcement.body}</span>
              )}
            </div>
            <button
              onClick={() => handleDismiss(announcement.id)}
              className={`shrink-0 cursor-pointer rounded p-0.5 transition-colors ${styles.icon}`}
              aria-label="Dismiss announcement"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
