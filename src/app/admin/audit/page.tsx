'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { ChevronLeftIcon } from '@/components/ui/chevron-left'
import { ChevronRightIcon } from '@/components/ui/chevron-right'
import { DownloadIcon } from '@/components/ui/download'
import { XIcon } from '@/components/ui/x'
import { ChevronDownIcon } from '@/components/ui/chevron-down'
import { ChevronUpIcon } from '@/components/ui/chevron-up'

interface AuditEvent {
  id: string
  actorId: string | null
  userId: string | null
  action: string
  targetType: string | null
  targetId: string | null
  metadata: string | null
  ip: string | null
  userAgent: string | null
  createdAt: string
  actor: { email: string; name: string | null; role: string } | null
  targetUser: { email: string; name: string | null; role: string } | null
}

const ACTION_TYPES = [
  'user.login',
  'user.register',
  'user.password_changed',
  'user.profile_updated',
  'user.deleted',
  'provider_key.created',
  'provider_key.updated',
  'provider_key.deleted',
  'platform_key.created',
  'platform_key.updated',
  'platform_key.deleted',
  'admin.user.suspended',
  'admin.user.role_changed',
  'admin.user.deleted',
  'admin.key.deleted',
  'admin.key.revoked',
  'admin.key.force_disabled',
  'admin.incident.leaked_key',
  'admin.config.changed',
  'admin.flag.toggled',
]

export default function AdminAuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [actorFilter, setActorFilter] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const { addToast } = useToast()

  const fetchEvents = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '50' })
    if (actorFilter) params.set('actorId', actorFilter)
    if (userFilter) params.set('userId', userFilter)
    if (actionFilter) params.set('action', actionFilter)
    if (fromDate) params.set('from', fromDate)
    if (toDate) params.set('to', toDate)
    fetch(`/api/admin/audit?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load audit events')
        return res.json()
      })
      .then((data) => {
        setEvents(data.events)
        setTotal(data.total)
      })
      .catch(() => {
        addToast({ title: 'Failed to load audit events', variant: 'destructive' })
      })
      .finally(() => setLoading(false))
  }, [page, actorFilter, userFilter, actionFilter, fromDate, toDate, addToast])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  function exportCSV() {
    const params = new URLSearchParams()
    if (actorFilter) params.set('actorId', actorFilter)
    if (userFilter) params.set('userId', userFilter)
    if (actionFilter) params.set('action', actionFilter)
    if (fromDate) params.set('from', fromDate)
    if (toDate) params.set('to', toDate)
    window.open(`/api/admin/audit/export?${params}`, '_blank')
  }

  function clearFilters() {
    setActorFilter('')
    setUserFilter('')
    setActionFilter('')
    setFromDate('')
    setToDate('')
    setPage(1)
  }

  const hasActiveFilters = actorFilter || userFilter || actionFilter || fromDate || toDate
  const totalPages = Math.ceil(total / 50)

  function parseMetadata(raw: string | null): Record<string, unknown> | null {
    if (!raw) return null
    try { return JSON.parse(raw) } catch { return null }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Audit Trail</h1>
          <p className="text-muted-foreground">{total.toLocaleString()} total events</p>
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
          <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v === 'all' ? '' : v); setPage(1) }}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {ACTION_TYPES.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Actor ID</Label>
          <Input
            placeholder="Filter by actor ID..."
            value={actorFilter}
            onChange={(e) => { setActorFilter(e.target.value); setPage(1) }}
            className="w-44"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Target User ID</Label>
          <Input
            placeholder="Filter by user ID..."
            value={userFilter}
            onChange={(e) => { setUserFilter(e.target.value); setPage(1) }}
            className="w-44"
          />
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
            <XIcon size={16} className="mr-1" />
            Clear
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Target User</TableHead>
                <TableHead>IP</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [...Array(10)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No audit events found
                  </TableCell>
                </TableRow>
              ) : (
                events.map((event) => {
                  const meta = parseMetadata(event.metadata)
                  const isExpanded = expandedId === event.id
                  return (
                    <React.Fragment key={event.id}>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setExpandedId(isExpanded ? null : event.id)}
                      >
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(event.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge className={
                              event.actor?.role === 'SUPER_ADMIN'
                                ? 'bg-red-500/10 text-red-400'
                                : 'bg-card text-muted-foreground'
                            }>
                              {event.actor?.role === 'SUPER_ADMIN' ? 'ADMIN' : 'USER'}
                            </Badge>
                            <div>
                              <p className="text-xs text-muted-foreground">{event.actor?.name || event.actor?.email || event.actorId || 'Deleted User'}</p>
                              {event.actor?.email && (
                                <p className="text-[10px] text-muted-foreground">{event.actor.email}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs text-primary bg-primary/5 px-1.5 py-0.5 rounded">
                            {event.action}
                          </code>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {event.targetType && (
                            <span>{event.targetType}</span>
                          )}
                          {event.targetId && (
                            <p className="text-[10px] text-muted-foreground font-mono truncate max-w-32">{event.targetId}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {event.targetUser ? (
                            <>
                              <p className="text-muted-foreground">{event.targetUser.name || event.targetUser.email}</p>
                              <p className="text-[10px] text-muted-foreground">{event.targetUser.email}</p>
                            </>
                          ) : event.userId ? (
                            <span className="font-mono text-[10px] text-muted-foreground">{event.userId}</span>
                          ) : (
                            <span className="text-zinc-700">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {event.ip || '-'}
                        </TableCell>
                        <TableCell>
                          {meta && (
                            isExpanded
                              ? <ChevronUpIcon size={16} className="text-muted-foreground" />
                              : <ChevronDownIcon size={16} className="text-muted-foreground" />
                          )}
                        </TableCell>
                      </TableRow>
                      {isExpanded && meta && (
                        <TableRow key={`${event.id}-meta`}>
                          <TableCell colSpan={7} className="bg-muted/50 p-4">
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-muted-foreground">Metadata</p>
                              <pre className="text-xs text-muted-foreground bg-background border border-border rounded-lg p-3 whitespace-pre-wrap">
                                {JSON.stringify(meta, null, 2)}
                              </pre>
                              {(meta as any).reason && (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground">Justification</p>
                                  <p className="text-sm text-muted-foreground mt-1">{(meta as any).reason}</p>
                                </div>
                              )}
                              {event.userAgent && (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground">User Agent</p>
                                  <p className="text-xs text-muted-foreground mt-1 break-all">{event.userAgent}</p>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeftIcon size={16} />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              <ChevronRightIcon size={16} />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
