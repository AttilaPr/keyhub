'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { ChevronLeftIcon } from '@/components/ui/chevron-left'
import { ChevronRightIcon } from '@/components/ui/chevron-right'
import { DownloadIcon } from '@/components/ui/download'
import { CopyIcon } from '@/components/ui/copy'
import { CheckIcon } from '@/components/ui/check'
import { RadioIcon } from '@/components/ui/radio'
import { formatCurrency } from '@/lib/utils'

interface LogEntry {
  id: string
  userId: string
  provider: string
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  costUsd: number
  status: string
  errorMessage: string | null
  latencyMs: number
  prompt: string
  response: string | null
  createdAt: string
  user: { email: string; name: string | null }
  platformKey: { label: string; keyPrefix: string; userId: string }
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [provider, setProvider] = useState('')
  const [status, setStatus] = useState('')
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [liveMode, setLiveMode] = useState(false)
  const liveRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { addToast } = useToast()

  const fetchLogs = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '50' })
    if (provider) params.set('provider', provider)
    if (status) params.set('status', status)
    fetch(`/api/admin/logs?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load logs')
        return res.json()
      })
      .then((data) => {
        setLogs(data.logs)
        setTotal(data.total)
      })
      .catch(() => {
        addToast({ title: 'Failed to load logs', variant: 'destructive' })
      })
      .finally(() => setLoading(false))
  }, [page, provider, status])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  // Live mode: auto-refresh every 5 seconds
  useEffect(() => {
    if (liveMode) {
      liveRef.current = setInterval(() => {
        fetchLogs()
      }, 5000)
    } else {
      if (liveRef.current) {
        clearInterval(liveRef.current)
        liveRef.current = null
      }
    }
    return () => {
      if (liveRef.current) {
        clearInterval(liveRef.current)
        liveRef.current = null
      }
    }
  }, [liveMode, fetchLogs])

  async function copyToClipboard(text: string, field: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      // Clipboard API not available
    }
  }

  function exportCSV() {
    const params = new URLSearchParams()
    if (provider) params.set('provider', provider)
    if (status) params.set('status', status)
    window.open(`/api/admin/logs/export?${params}`, '_blank')
  }

  const totalPages = Math.ceil(total / 50)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Global Logs</h1>
          <p className="text-muted-foreground">{total.toLocaleString()} total requests</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant={liveMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => setLiveMode(!liveMode)}
            className={liveMode ? 'bg-lime-600 hover:bg-lime-700 text-foreground' : ''}
          >
            <RadioIcon size={16} className={`mr-2 ${liveMode ? 'animate-pulse' : ''}`} />
            {liveMode ? 'Live' : 'Live'}
          </Button>
          <Button variant="outline" onClick={exportCSV}>
            <DownloadIcon size={16} className="mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="flex gap-3">
        <Select value={provider} onValueChange={(v) => { setProvider(v === 'all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All providers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All providers</SelectItem>
            <SelectItem value="openai">OpenAI</SelectItem>
            <SelectItem value="anthropic">Anthropic</SelectItem>
            <SelectItem value="google">Google</SelectItem>
            <SelectItem value="mistral">Mistral</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Tokens</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Latency</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && logs.length === 0 ? (
                [...Array(10)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No logs found
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow
                    key={log.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedLog(log)}
                  >
                    <TableCell>
                      <p className="text-xs text-muted-foreground">{log.user.name || log.user.email}</p>
                      <p className="text-[10px] text-muted-foreground">{log.user.email}</p>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">{log.model}</span>
                      <p className="text-[10px] text-muted-foreground capitalize">{log.provider}</p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={log.status === 'success' ? 'bg-primary/10 text-primary' : 'bg-red-500/10 text-red-400'}
                      >
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {log.totalTokens.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {formatCurrency(log.costUsd)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {log.latencyMs}ms
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
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

      {/* Log Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request Details (Admin)</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">User:</span>
                  <span className="ml-2 text-foreground">{selectedLog.user.name || selectedLog.user.email}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">User ID:</span>
                  <span className="ml-2 text-foreground font-mono text-xs">{selectedLog.userId}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">User Email:</span>
                  <span className="ml-2 text-foreground text-xs">{selectedLog.user.email}</span>
                </div>
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
                    className={`ml-2 ${selectedLog.status === 'success' ? 'bg-primary/10 text-primary' : 'bg-red-500/10 text-red-400'}`}
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
                  <span className="text-muted-foreground">Key Owner ID:</span>
                  <span className="ml-2 text-foreground font-mono text-xs">{selectedLog.platformKey.userId}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Time:</span>
                  <span className="ml-2 text-foreground">{new Date(selectedLog.createdAt).toLocaleString()}</span>
                </div>
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
                      <CheckIcon size={16} className="text-primary" />
                    ) : (
                      <CopyIcon size={16} />
                    )}
                    <span className="ml-1 text-xs">{copiedField === 'prompt' ? 'Copied' : 'Copy'}</span>
                  </Button>
                </div>
                <pre className="rounded-lg bg-muted border border-border p-3 text-xs text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(selectedLog.prompt), null, 2)
                    } catch {
                      return selectedLog.prompt
                    }
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
                        <CheckIcon size={16} className="text-primary" />
                      ) : (
                        <CopyIcon size={16} />
                      )}
                      <span className="ml-1 text-xs">{copiedField === 'response' ? 'Copied' : 'Copy'}</span>
                    </Button>
                  </div>
                  <pre className="rounded-lg bg-muted border border-border p-3 text-xs text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {selectedLog.response}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
