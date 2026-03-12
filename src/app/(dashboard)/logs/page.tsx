'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useOrgs } from '@/contexts/orgs-context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/components/ui/toast'
import { ArrowUpDown, ExternalLink } from 'lucide-react'
import { ScanTextIcon } from '@/components/ui/scan-text'
import { ChevronLeftIcon } from '@/components/ui/chevron-left'
import { ChevronRightIcon } from '@/components/ui/chevron-right'
import { DownloadIcon } from '@/components/ui/download'
import { XIcon } from '@/components/ui/x'
import { SearchIcon } from '@/components/ui/search'
import { CopyIcon } from '@/components/ui/copy'
import { CheckIcon } from '@/components/ui/check'
import { ArrowUpIcon } from '@/components/ui/arrow-up'
import { ArrowDownIcon } from '@/components/ui/arrow-down'
import { BadgeAlertIcon } from '@/components/ui/badge-alert'
import { RefreshCWIcon } from '@/components/ui/refresh-cw'
import { PlayIcon } from '@/components/ui/play'
import { LoaderPinwheelIcon } from '@/components/ui/loader-pinwheel'
import { useAnimatedIcon } from '@/hooks/use-animated-icon'
import { formatCurrency } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/fetch'

function highlightText(text: string, search: string): React.ReactNode {
  if (!search || !search.trim()) return text
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === search.toLowerCase() ? (
      <mark key={i} className="bg-primary/30 text-lime-200 rounded-sm px-0.5">{part}</mark>
    ) : (
      part
    )
  )
}

// Populated from /api/models on mount
const FALLBACK_PROVIDER_MODELS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini'],
  anthropic: ['claude-3-5-sonnet-20241022'],
  google: ['gemini-2.0-flash'],
  mistral: ['mistral-large-latest'],
}

interface LogEntry {
  id: string
  provider: string
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  costUsd: number
  status: string
  errorMessage: string | null
  latencyMs: number
  createdAt: string
  prompt: string
  response: string | null
  tag: string | null
  fallbackUsed: boolean
  originalProvider: string | null
  fallbackProvider: string | null
  platformKey: { label: string; keyPrefix: string }
}

interface ReplayResult {
  response: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  costUsd: number
  latencyMs: number
}

interface PlatformKeyOption {
  id: string
  label: string
  keyPrefix: string
}

export default function LogsPage() {
  const { activeOrgId } = useOrgs()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [providerFilter, setProviderFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [modelFilter, setModelFilter] = useState('all')
  const [keyFilter, setKeyFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState('all')
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [providerModels, setProviderModels] = useState<Record<string, string[]>>(FALLBACK_PROVIDER_MODELS)
  const [platformKeys, setPlatformKeys] = useState<PlatformKeyOption[]>([])
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [replayOpen, setReplayOpen] = useState(false)
  const [replaying, setReplaying] = useState(false)
  const [replayResult, setReplayResult] = useState<ReplayResult | null>(null)
  const [replayOriginal, setReplayOriginal] = useState<{ response: string | null; promptTokens: number; completionTokens: number; totalTokens: number; costUsd: number; latencyMs: number } | null>(null)
  const { addToast } = useToast()
  const router = useRouter()
  const { iconRef: emptyIconRef, handlers: emptyHandlers } = useAnimatedIcon()
  const { iconRef: errorIconRef, handlers: errorHandlers } = useAnimatedIcon()

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller

    async function loadFilterData() {
      try {
        const [keysRes, modelsRes, usageRes] = await Promise.all([
          fetch('/api/keys/platform', { signal }),
          fetch('/api/models', { signal }),
          fetch('/api/usage?days=365', { signal }),
        ])

        if (keysRes.ok) {
          const data: { id: string; label: string; keyPrefix: string }[] = await keysRes.json()
          setPlatformKeys(data.map((k) => ({ id: k.id, label: k.label, keyPrefix: k.keyPrefix })))
        } else {
          addToast({ title: 'Could not load API keys for filter', variant: 'destructive' })
        }

        if (modelsRes.ok) {
          const data: { providers: { key: string; models: string[] }[] } | null = await modelsRes.json()
          if (data?.providers) {
            const map: Record<string, string[]> = {}
            for (const p of data.providers) {
              map[p.key] = p.models.map((m) => m.replace(`${p.key}/`, ''))
            }
            setProviderModels(map)
          }
        }

        if (usageRes.ok) {
          const data = await usageRes.json()
          if (data?.tags) setAvailableTags(data.tags)
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
      }
    }

    loadFilterData()
    return () => controller.abort()
  }, [addToast, activeOrgId])

  // Debounce search input
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setSearchQuery(value)
      setPage(1)
    }, 400)
  }, [])

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
    }
  }, [])

  function toggleSort(field: string) {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setPage(1)
  }

  function SortIcon({ field }: { field: string }) {
    if (sortBy !== field) return <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground" />
    return sortOrder === 'asc'
      ? <span className="ml-1 text-primary"><ArrowUpIcon size={14} /></span>
      : <span className="ml-1 text-primary"><ArrowDownIcon size={14} /></span>
  }

  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  async function copyToClipboard(text: string, field: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
      copiedTimerRef.current = setTimeout(() => setCopiedField(null), 2000)
    } catch {
      addToast({ title: 'Failed to copy', description: 'Could not access clipboard', variant: 'destructive' })
    }
  }

  async function handleReplay(log: LogEntry) {
    setReplaying(true)
    setReplayResult(null)
    setReplayOriginal({
      response: log.response,
      promptTokens: log.promptTokens,
      completionTokens: log.completionTokens,
      totalTokens: log.totalTokens,
      costUsd: log.costUsd,
      latencyMs: log.latencyMs,
    })
    setReplayOpen(true)

    try {
      // Get original request data
      const replayRes = await apiFetch(`/api/logs/${log.id}/replay`, { method: 'POST' })
      if (!replayRes.ok) {
        const data = await replayRes.json()
        addToast({ title: 'Replay failed', description: data.error || 'Could not fetch original request', variant: 'destructive' })
        setReplaying(false)
        return
      }

      const replayData = await replayRes.json()

      // Make the actual replay request
      const replayStart = Date.now()
      const completionRes = await apiFetch('/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer replay-internal`,
        },
        body: JSON.stringify({
          model: `${replayData.provider}/${replayData.model}`,
          messages: replayData.messages,
          stream: false,
        }),
      })
      const replayLatency = Date.now() - replayStart

      if (completionRes.ok) {
        // For streaming response, collect the text
        const text = await completionRes.text()
        setReplayResult({
          response: text,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          costUsd: 0,
          latencyMs: replayLatency,
        })
      } else {
        const errText = await completionRes.text()
        setReplayResult({
          response: `Error: ${errText}`,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          costUsd: 0,
          latencyMs: replayLatency,
        })
      }
    } catch (err: unknown) {
      addToast({ title: 'Replay error', description: err instanceof Error ? err.message : 'Replay failed', variant: 'destructive' })
    } finally {
      setReplaying(false)
    }
  }

  function openInPlayground(log: LogEntry) {
    try {
      const messages = JSON.parse(log.prompt)
      const params = new URLSearchParams({
        model: `${log.provider}/${log.model}`,
        messages: JSON.stringify(messages),
      })
      router.push(`/playground?${params}`)
    } catch {
      addToast({ title: 'Error', description: 'Could not parse messages for playground', variant: 'destructive' })
    }
  }

  async function fetchLogs(signal?: AbortSignal) {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ page: String(page), limit: '25' })
    if (providerFilter !== 'all') params.set('provider', providerFilter)
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (modelFilter !== 'all') params.set('model', modelFilter)
    if (keyFilter !== 'all') params.set('platformKeyId', keyFilter)
    if (tagFilter !== 'all') params.set('tag', tagFilter)
    if (fromDate) params.set('from', fromDate)
    if (toDate) params.set('to', toDate)
    if (searchQuery) params.set('search', searchQuery)
    if (sortBy !== 'createdAt') params.set('sortBy', sortBy)
    if (sortOrder !== 'desc') params.set('sortOrder', sortOrder)

    try {
      const res = await fetch(`/api/logs?${params}`, { signal })
      if (!res.ok) throw new Error(`Server error (${res.status})`)
      const data = await res.json()
      setLogs(data.logs)
      setTotal(data.total)
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Failed to load logs')
      setLogs([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    fetchLogs(controller.signal)
    return () => controller.abort()
  }, [page, providerFilter, statusFilter, modelFilter, keyFilter, tagFilter, fromDate, toDate, searchQuery, sortBy, sortOrder, activeOrgId])

  const availableModels = providerFilter !== 'all'
    ? providerModels[providerFilter] || []
    : Object.values(providerModels).flat()

  function clearFilters() {
    setProviderFilter('all')
    setStatusFilter('all')
    setModelFilter('all')
    setKeyFilter('all')
    setTagFilter('all')
    setFromDate('')
    setToDate('')
    setSearchInput('')
    setSearchQuery('')
    setSortBy('createdAt')
    setSortOrder('desc')
    setPage(1)
  }

  const hasActiveFilters = providerFilter !== 'all' || statusFilter !== 'all' || modelFilter !== 'all' || keyFilter !== 'all' || tagFilter !== 'all' || fromDate || toDate || searchQuery || sortBy !== 'createdAt' || sortOrder !== 'desc'

  const totalPages = Math.ceil(total / 25)

  function exportCSV() {
    const params = new URLSearchParams()
    if (providerFilter !== 'all') params.set('provider', providerFilter)
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (modelFilter !== 'all') params.set('model', modelFilter)
    if (keyFilter !== 'all') params.set('platformKeyId', keyFilter)
    if (tagFilter !== 'all') params.set('tag', tagFilter)
    if (fromDate) params.set('from', fromDate)
    if (toDate) params.set('to', toDate)
    if (searchQuery) params.set('search', searchQuery)
    window.open(`/api/logs/export?${params}`, '_blank')
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Request Logs</h1>
          <p className="text-muted-foreground">{total} total requests</p>
        </div>
        <Button variant="outline" onClick={exportCSV}>
          <DownloadIcon size={16} className="mr-2" />
          Export All CSV
        </Button>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Search</Label>
          <div className="relative">
            <span className="absolute left-2.5 top-2.5 text-muted-foreground"><SearchIcon size={16} /></span>
            <Input
              placeholder="Search prompts & responses..."
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-56 pl-9"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Provider</Label>
          <Select value={providerFilter} onValueChange={(v) => { setProviderFilter(v ?? 'all'); setModelFilter('all'); setPage(1) }}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Providers</SelectItem>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="anthropic">Anthropic</SelectItem>
              <SelectItem value="google">Google</SelectItem>
              <SelectItem value="mistral">Mistral</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Model</Label>
          <Select value={modelFilter} onValueChange={(v) => { setModelFilter(v ?? 'all'); setPage(1) }}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Models</SelectItem>
              {availableModels.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v ?? 'all'); setPage(1) }}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">API Key</Label>
          <Select value={keyFilter} onValueChange={(v) => { setKeyFilter(v ?? 'all'); setPage(1) }}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="API Key" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Keys</SelectItem>
              {platformKeys.map((k) => (
                <SelectItem key={k.id} value={k.id}>
                  {k.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {availableTags.length > 0 && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tag</Label>
            <Select value={tagFilter} onValueChange={(v) => { setTagFilter(v ?? 'all'); setPage(1) }}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tags</SelectItem>
                {availableTags.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
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
            <XIcon size={14} className="mr-1" />
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
        <Card {...errorHandlers}>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <span className="text-red-400 mb-4"><BadgeAlertIcon ref={errorIconRef} size={48} /></span>
            <p className="text-muted-foreground font-medium mb-1">Failed to load logs</p>
            <p className="text-muted-foreground text-sm mb-4">{error}</p>
            <Button variant="outline" onClick={() => fetchLogs()} className="gap-2">
              <RefreshCWIcon size={16} />
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : logs.length === 0 ? (
        <Card {...emptyHandlers}>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <span className="text-muted-foreground mb-4"><ScanTextIcon ref={emptyIconRef} size={48} /></span>
            <p className="text-muted-foreground">No logs yet. Make API requests to see them here.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('createdAt')}>
                    <span className="inline-flex items-center">Time<SortIcon field="createdAt" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('provider')}>
                    <span className="inline-flex items-center">Provider<SortIcon field="provider" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('model')}>
                    <span className="inline-flex items-center">Model<SortIcon field="model" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('totalTokens')}>
                    <span className="inline-flex items-center">Tokens<SortIcon field="totalTokens" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('costUsd')}>
                    <span className="inline-flex items-center">Cost<SortIcon field="costUsd" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('latencyMs')}>
                    <span className="inline-flex items-center">Latency<SortIcon field="latencyMs" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('status')}>
                    <span className="inline-flex items-center">Status<SortIcon field="status" /></span>
                  </TableHead>
                  <TableHead>Tag</TableHead>
                  <TableHead>Key</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow
                    key={log.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedLog(log)}
                  >
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{log.provider}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">{log.model}</TableCell>
                    <TableCell className="text-muted-foreground">{log.totalTokens.toLocaleString()}</TableCell>
                    <TableCell className="text-muted-foreground">{formatCurrency(log.costUsd)}</TableCell>
                    <TableCell className="text-muted-foreground">{log.latencyMs}ms</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Badge
                          variant={log.status === 'success' ? 'default' : 'destructive'}
                          className={log.status === 'success' ? 'bg-primary/10 text-primary' : undefined}
                        >
                          {log.status}
                        </Badge>
                        {log.fallbackUsed && (
                          <Badge variant="outline" className="text-[10px] border-yellow-500/30 text-yellow-400 px-1 py-0">
                            FB
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.tag ? (
                        <Badge variant="outline" className="text-xs font-mono">
                          {log.tag}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">--</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs text-muted-foreground">{log.platformKey.keyPrefix}...</code>
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

      {/* Log Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request Details</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Provider:</span>
                  <span className="ml-2 text-foreground">{selectedLog.provider}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Model:</span>
                  <span className="ml-2 text-foreground font-mono">{selectedLog.model}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <Badge
                    variant={selectedLog.status === 'success' ? 'default' : 'destructive'}
                    className={selectedLog.status === 'success' ? 'ml-2 bg-primary/10 text-primary' : 'ml-2'}
                  >
                    {selectedLog.status}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Latency:</span>
                  <span className="ml-2 text-foreground">{selectedLog.latencyMs}ms</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Prompt Tokens:</span>
                  <span className="ml-2 text-foreground">{selectedLog.promptTokens.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Completion Tokens:</span>
                  <span className="ml-2 text-foreground">{selectedLog.completionTokens.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Tokens:</span>
                  <span className="ml-2 text-foreground">{selectedLog.totalTokens.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Cost:</span>
                  <span className="ml-2 text-foreground">{formatCurrency(selectedLog.costUsd)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">API Key:</span>
                  <span className="ml-2 text-foreground">{selectedLog.platformKey.label}</span>
                  <code className="ml-1 text-xs text-muted-foreground">({selectedLog.platformKey.keyPrefix}...)</code>
                </div>
                <div>
                  <span className="text-muted-foreground">Time:</span>
                  <span className="ml-2 text-foreground">{new Date(selectedLog.createdAt).toLocaleString()}</span>
                </div>
                {selectedLog.tag && (
                  <div>
                    <span className="text-muted-foreground">Tag:</span>
                    <Badge variant="outline" className="ml-2 text-xs font-mono">
                      {selectedLog.tag}
                    </Badge>
                  </div>
                )}
                {selectedLog.fallbackUsed && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Fallback:</span>
                    <Badge variant="outline" className="ml-2 text-xs border-yellow-500/30 text-yellow-400">
                      <RefreshCWIcon size={14} className="mr-1" />
                      {selectedLog.originalProvider} → {selectedLog.fallbackProvider}
                    </Badge>
                  </div>
                )}
              </div>

              {selectedLog.errorMessage && (
                <div>
                  <h3 className="text-sm font-medium text-red-400 mb-1">Error</h3>
                  <pre className="rounded-lg bg-red-950/50 border border-red-900 p-3 text-xs text-red-300 whitespace-pre-wrap">
                    {selectedLog.errorMessage}
                  </pre>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-medium text-muted-foreground">Prompt</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-muted-foreground hover:text-muted-foreground"
                    onClick={() => {
                      let text = selectedLog.prompt
                      try { text = JSON.stringify(JSON.parse(text), null, 2) } catch {}
                      copyToClipboard(text, 'prompt')
                    }}
                  >
                    {copiedField === 'prompt' ? (
                      <span className="text-primary"><CheckIcon size={14} /></span>
                    ) : (
                      <CopyIcon size={14} />
                    )}
                    <span className="ml-1 text-xs">{copiedField === 'prompt' ? 'Copied' : 'Copy'}</span>
                  </Button>
                </div>
                <pre className="rounded-lg bg-muted border border-border p-3 text-xs text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {(() => {
                    let text: string
                    try {
                      text = JSON.stringify(JSON.parse(selectedLog.prompt), null, 2)
                    } catch {
                      text = selectedLog.prompt
                    }
                    return searchQuery ? highlightText(text, searchQuery) : text
                  })()}
                </pre>
              </div>

              {selectedLog.response && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-medium text-muted-foreground">Response</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-muted-foreground hover:text-muted-foreground"
                      onClick={() => copyToClipboard(selectedLog.response!, 'response')}
                    >
                      {copiedField === 'response' ? (
                        <span className="text-primary"><CheckIcon size={14} /></span>
                      ) : (
                        <CopyIcon size={14} />
                      )}
                      <span className="ml-1 text-xs">{copiedField === 'response' ? 'Copied' : 'Copy'}</span>
                    </Button>
                  </div>
                  <pre className="rounded-lg bg-muted border border-border p-3 text-xs text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {searchQuery ? highlightText(selectedLog.response!, searchQuery) : selectedLog.response}
                  </pre>
                </div>
              )}

              <Separator />

              {/* Replay & Playground Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleReplay(selectedLog)}
                  disabled={replaying}
                >
                  {replaying ? (
                    <LoaderPinwheelIcon size={16} className="mr-2 animate-spin" />
                  ) : (
                    <PlayIcon size={16} className="mr-2" />
                  )}
                  Replay Request
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openInPlayground(selectedLog)}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open in Playground
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Replay Comparison Dialog */}
      <Dialog open={replayOpen} onOpenChange={(open) => { if (!open) { setReplayOpen(false); setReplayResult(null); setReplayOriginal(null) } }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Replay Comparison</DialogTitle>
          </DialogHeader>
          {replaying && !replayResult && (
            <div className="flex flex-col items-center justify-center py-12">
              <span className="text-primary mb-4"><LoaderPinwheelIcon size={32} className="animate-spin" /></span>
              <p className="text-muted-foreground text-sm">Replaying request...</p>
            </div>
          )}
          {replayOriginal && replayResult && (
            <div className="space-y-4">
              {/* Comparison Metrics */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-border p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Latency Delta</p>
                  <p className={`text-sm font-medium ${replayResult.latencyMs > replayOriginal.latencyMs ? 'text-red-400' : 'text-primary'}`}>
                    {replayResult.latencyMs > replayOriginal.latencyMs ? '+' : ''}
                    {replayResult.latencyMs - replayOriginal.latencyMs}ms
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {replayOriginal.latencyMs}ms → {replayResult.latencyMs}ms
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Token Delta</p>
                  <p className={`text-sm font-medium ${replayResult.totalTokens > replayOriginal.totalTokens ? 'text-red-400' : replayResult.totalTokens < replayOriginal.totalTokens ? 'text-primary' : 'text-muted-foreground'}`}>
                    {replayResult.totalTokens > replayOriginal.totalTokens ? '+' : ''}
                    {replayResult.totalTokens - replayOriginal.totalTokens}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {replayOriginal.totalTokens.toLocaleString()} → {replayResult.totalTokens.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Cost Delta</p>
                  <p className={`text-sm font-medium ${replayResult.costUsd > replayOriginal.costUsd ? 'text-red-400' : replayResult.costUsd < replayOriginal.costUsd ? 'text-primary' : 'text-muted-foreground'}`}>
                    {replayResult.costUsd > replayOriginal.costUsd ? '+' : ''}
                    {formatCurrency(replayResult.costUsd - replayOriginal.costUsd)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatCurrency(replayOriginal.costUsd)} → {formatCurrency(replayResult.costUsd)}
                  </p>
                </div>
              </div>

              {/* Side-by-side responses */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Original Response</h3>
                  <pre className="rounded-lg bg-muted border border-border p-3 text-xs text-muted-foreground whitespace-pre-wrap max-h-64 overflow-y-auto">
                    {replayOriginal.response || '(no response)'}
                  </pre>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Replay Response</h3>
                  <pre className="rounded-lg bg-muted border border-lime-400/20 p-3 text-xs text-muted-foreground whitespace-pre-wrap max-h-64 overflow-y-auto">
                    {replayResult.response}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
