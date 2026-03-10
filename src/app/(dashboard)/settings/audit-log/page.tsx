'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { ClipboardCheckIcon } from '@/components/ui/clipboard-check'
import { ChevronLeftIcon } from '@/components/ui/chevron-left'
import { ChevronRightIcon } from '@/components/ui/chevron-right'
import { DownloadIcon } from '@/components/ui/download'
import { XIcon } from '@/components/ui/x'
import { BadgeAlertIcon } from '@/components/ui/badge-alert'
import { RefreshCWIcon } from '@/components/ui/refresh-cw'
import { useAnimatedIcon } from '@/hooks/use-animated-icon'

const ACTION_TYPES = [
  'user.login',
  'user.logout',
  'user.password_changed',
  'user.deleted',
  'provider_key.created',
  'provider_key.deleted',
  'platform_key.created',
  'platform_key.deleted',
  'platform_key.toggled',
  'org.member_invited',
  'org.member_removed',
  'org.member_role_changed',
]

interface AuditEvent {
  id: string
  userId: string | null
  actorId: string | null
  action: string
  targetType: string | null
  targetId: string | null
  metadata: string | null
  ip: string | null
  userAgent: string | null
  createdAt: string
}

export default function AuditLogPage() {
  const { iconRef: clipboardIconRef, handlers: clipboardIconHandlers } = useAnimatedIcon()
  const { iconRef: errorIconRef, handlers: errorIconHandlers } = useAnimatedIcon()
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { addToast } = useToast()
  const limit = 20

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (actionFilter !== 'all') params.set('action', actionFilter)
    if (fromDate) params.set('from', fromDate)
    if (toDate) params.set('to', toDate)

    try {
      const res = await fetch(`/api/audit?${params}`)
      if (!res.ok) throw new Error(`Server error (${res.status})`)
      const data = await res.json()
      setEvents(data.events)
      setTotal(data.total)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load audit log'
      setError(message)
      setEvents([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, actionFilter, fromDate, toDate])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  function clearFilters() {
    setActionFilter('all')
    setFromDate('')
    setToDate('')
    setPage(1)
  }

  const hasActiveFilters = actionFilter !== 'all' || fromDate || toDate
  const totalPages = Math.ceil(total / limit)

  function exportCSV() {
    const params = new URLSearchParams()
    if (actionFilter !== 'all') params.set('action', actionFilter)
    if (fromDate) params.set('from', fromDate)
    if (toDate) params.set('to', toDate)
    window.open(`/api/audit/export?${params}`, '_blank')
  }

  function formatAction(action: string) {
    return action.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }

  function actionColor(action: string): string {
    if (action.includes('deleted') || action.includes('removed')) return 'bg-red-400/10 text-red-400'
    if (action.includes('created') || action.includes('login')) return 'bg-primary/10 text-primary'
    if (action.includes('toggled') || action.includes('changed')) return 'bg-yellow-400/10 text-yellow-400'
    return 'bg-zinc-400/10 text-muted-foreground'
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
          <p className="text-muted-foreground">{total} total events</p>
        </div>
        <Button variant="outline" onClick={exportCSV}>
          <DownloadIcon size={16} className="mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Action Type</Label>
          <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v ?? 'all'); setPage(1) }}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Action Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {ACTION_TYPES.map((a) => (
                <SelectItem key={a} value={a}>
                  {formatAction(a)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">From</Label>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => { setFromDate(e.target.value); setPage(1) }}
            className="w-38"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">To</Label>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => { setToDate(e.target.value); setPage(1) }}
            className="w-38"
          />
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground hover:text-muted-foreground">
            <XIcon size={12} className="mr-1" />
            Clear
          </Button>
        )}
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </CardContent>
        </Card>
      ) : error ? (
        <Card {...errorIconHandlers}>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BadgeAlertIcon ref={errorIconRef} size={48} className="text-red-400 mb-4" />
            <p className="text-muted-foreground font-medium mb-1">Failed to load audit log</p>
            <p className="text-muted-foreground text-sm mb-4">{error}</p>
            <Button variant="outline" onClick={fetchEvents} className="gap-2">
              <RefreshCWIcon size={16} />
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : events.length === 0 ? (
        <Card {...clipboardIconHandlers}>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ClipboardCheckIcon ref={clipboardIconRef} size={48} className="text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No audit events found.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {new Date(event.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm font-mono">
                      {event.actorId ? `${event.actorId.slice(0, 8)}...` : 'System'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="default" className={actionColor(event.action)}>
                        {formatAction(event.action)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {event.targetType ? (
                        <span>
                          <span className="text-muted-foreground">{event.targetType}</span>
                          {event.targetId && (
                            <code className="ml-1 text-xs text-muted-foreground">{event.targetId.slice(0, 8)}...</code>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs font-mono">
                      {event.ip || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeftIcon size={16} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRightIcon size={16} />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
