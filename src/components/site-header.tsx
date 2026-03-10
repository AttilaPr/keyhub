"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { usePathname } from "next/navigation"
import { Separator } from "@/components/ui/separator"
import { apiFetch } from "@/lib/fetch"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { BellIcon } from "@/components/ui/bell"
import { CheckIcon } from "@/components/ui/check"
import { BadgeAlertIcon } from "@/components/ui/badge-alert"
import { DollarSignIcon } from "@/components/ui/dollar-sign"
import { LoaderPinwheelIcon } from "@/components/ui/loader-pinwheel"
import { ThemeToggle } from "@/components/theme-toggle"

import { LayoutPanelTopIcon } from "@/components/ui/layout-panel-top"
import { KeyIcon } from "@/components/ui/key"
import { ShieldCheckIcon } from "@/components/ui/shield-check"
import { ScanTextIcon } from "@/components/ui/scan-text"
import { ChartColumnIncreasingIcon } from "@/components/ui/chart-column-increasing"
import { MessageSquareIcon } from "@/components/ui/message-square"
import { ActivityIcon } from "@/components/ui/activity"
import { UsersIcon } from "@/components/ui/users"
import { BookTextIcon } from "@/components/ui/book-text"
import { SettingsIcon } from "@/components/ui/settings"
import { FileTextIcon } from "@/components/ui/file-text"
import { WebhookIcon } from "@/components/ui/webhook"
import { ClipboardCheckIcon } from "@/components/ui/clipboard-check"

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/provider-keys": "Provider Keys",
  "/platform-keys": "Platform Keys",
  "/logs": "Logs",
  "/usage": "Usage",
  "/playground": "Playground",
  "/status": "Status",
  "/organizations": "Organizations",
  "/docs": "Documentation",
  "/settings": "Settings",
  "/settings/templates": "Templates",
  "/settings/webhooks": "Webhooks",
  "/settings/audit-log": "Audit Log",
  "/admin": "Admin Panel",
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const pageIcons: Record<string, React.ComponentType<any>> = {
  "/dashboard": LayoutPanelTopIcon,
  "/provider-keys": KeyIcon,
  "/platform-keys": ShieldCheckIcon,
  "/logs": ScanTextIcon,
  "/usage": ChartColumnIncreasingIcon,
  "/playground": MessageSquareIcon,
  "/status": ActivityIcon,
  "/organizations": UsersIcon,
  "/docs": BookTextIcon,
  "/settings": SettingsIcon,
  "/settings/templates": FileTextIcon,
  "/settings/webhooks": WebhookIcon,
  "/settings/audit-log": ClipboardCheckIcon,
  "/admin": ShieldCheckIcon,
}

interface AnimatedIconHandle {
  startAnimation: () => void
  stopAnimation: () => void
}

function getPageMatch(pathname: string) {
  // Try exact match first
  if (pageTitles[pathname]) return pathname
  // Try longest prefix match (most specific first)
  const sorted = Object.keys(pageTitles).sort((a, b) => b.length - a.length)
  for (const path of sorted) {
    if (pathname.startsWith(path + "/")) return path
  }
  return null
}

function HeaderTitle({ pathname }: { pathname: string }) {
  const iconRef = useRef<AnimatedIconHandle | null>(null)
  const matched = getPageMatch(pathname)
  const title = matched
    ? pageTitles[matched]
    : pathname.startsWith("/organizations/")
      ? "Organization Settings"
      : "KeyHub"
  const Icon = matched ? pageIcons[matched] : null

  return (
    <div
      className="flex items-center gap-2"
      onMouseEnter={() => iconRef.current?.startAnimation?.()}
      onMouseLeave={() => iconRef.current?.stopAnimation?.()}
    >
      {Icon && <Icon ref={iconRef} size={18} className="shrink-0 text-muted-foreground" />}
      <h1 className="text-base font-medium">{title}</h1>
    </div>
  )
}

interface AnomalyEvent {
  id: string
  type: string
  severity: string
  description: string
  detectedAt: string
  acknowledgedAt: string | null
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const typeIcons: Record<string, React.ComponentType<any>> = {
  request_volume: ActivityIcon,
  cost_spike: DollarSignIcon,
  error_rate: BadgeAlertIcon,
  key_dominance: KeyIcon,
}

const typeLabels: Record<string, string> = {
  request_volume: "Request Volume Spike",
  cost_spike: "Cost Spike",
  error_rate: "High Error Rate",
  key_dominance: "Key Dominance",
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function SiteHeader() {
  const pathname = usePathname()

  const [unreadCount, setUnreadCount] = useState(0)
  const [events, setEvents] = useState<AnomalyEvent[]>([])
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [open, setOpen] = useState(false)
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null)

  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/count")
      if (res.ok) {
        const data = await res.json()
        setUnreadCount(data.count)
      }
    } catch {
      // Silent fail
    }
  }, [])

  const fetchEvents = useCallback(async () => {
    setLoadingEvents(true)
    try {
      const res = await fetch("/api/anomalies")
      if (res.ok) {
        const data = await res.json()
        setEvents(data)
      }
    } catch {
      // Silent fail
    } finally {
      setLoadingEvents(false)
    }
  }, [])

  useEffect(() => {
    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    return () => clearInterval(interval)
  }, [fetchCount])

  useEffect(() => {
    if (open) {
      fetchEvents()
    }
  }, [open, fetchEvents])

  async function handleAcknowledge(id: string) {
    setAcknowledgingId(id)
    try {
      const res = await apiFetch("/api/anomalies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        setEvents((prev) =>
          prev.map((e) =>
            e.id === id ? { ...e, acknowledgedAt: new Date().toISOString() } : e
          )
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }
    } catch {
      // Silent fail
    } finally {
      setAcknowledgingId(null)
    }
  }

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 h-4 data-vertical:self-auto"
        />
        <HeaderTitle pathname={pathname} />

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
              render={
                <Button variant="ghost" size="icon" className="relative h-8 w-8" />
              }
            >
              <BellIcon size={16} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-black">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </PopoverTrigger>
            <PopoverContent
              align="end"
              sideOffset={8}
              className="w-96 max-h-[28rem] overflow-hidden p-0"
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {unreadCount} unread
                  </span>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto">
                {loadingEvents ? (
                  <div className="flex items-center justify-center py-8">
                    <LoaderPinwheelIcon size={16} className="animate-spin text-muted-foreground" />
                  </div>
                ) : events.length === 0 ? (
                  <div className="py-8 text-center">
                    <BellIcon size={32} className="mx-auto text-zinc-700" />
                    <p className="mt-2 text-sm text-muted-foreground">No notifications</p>
                  </div>
                ) : (
                  events.map((event) => {
                    const Icon = typeIcons[event.type] || BadgeAlertIcon
                    const isAcknowledged = !!event.acknowledgedAt
                    return (
                      <div
                        key={event.id}
                        className={`flex gap-3 border-b border-border/50 px-4 py-3 last:border-b-0 ${
                          isAcknowledged ? "opacity-50" : ""
                        }`}
                      >
                        <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                          event.severity === "critical"
                            ? "bg-red-500/10"
                            : "bg-yellow-500/10"
                        }`}>
                          <Icon size={14} className={
                            event.severity === "critical"
                              ? "text-red-400"
                              : "text-yellow-400"
                          } />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-medium text-foreground/80">
                              {typeLabels[event.type] || event.type}
                            </p>
                            <span className="shrink-0 text-[10px] text-muted-foreground">
                              {timeAgo(event.detectedAt)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                            {event.description}
                          </p>
                          {!isAcknowledged && (
                            <button
                              className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary disabled:opacity-50"
                              onClick={() => handleAcknowledge(event.id)}
                              disabled={acknowledgingId === event.id}
                            >
                              {acknowledgingId === event.id ? (
                                <LoaderPinwheelIcon size={12} className="animate-spin" />
                              ) : (
                                <CheckIcon size={12} />
                              )}
                              Acknowledge
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </header>
  )
}
