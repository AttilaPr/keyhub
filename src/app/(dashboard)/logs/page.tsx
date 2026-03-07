'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollText, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

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
  platformKey: { label: string; keyPrefix: string }
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [providerFilter, setProviderFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null)

  async function fetchLogs() {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '25' })
    if (providerFilter !== 'all') params.set('provider', providerFilter)
    if (statusFilter !== 'all') params.set('status', statusFilter)

    const res = await fetch(`/api/logs?${params}`)
    const data = await res.json()
    setLogs(data.logs)
    setTotal(data.total)
    setLoading(false)
  }

  useEffect(() => { fetchLogs() }, [page, providerFilter, statusFilter])

  const totalPages = Math.ceil(total / 25)

  function exportCSV() {
    const headers = ['Timestamp', 'Provider', 'Model', 'Tokens', 'Cost', 'Status', 'Latency']
    const rows = logs.map((l) => [
      new Date(l.createdAt).toISOString(),
      l.provider,
      l.model,
      l.totalTokens,
      l.costUsd.toFixed(6),
      l.status,
      `${l.latencyMs}ms`,
    ])
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `keyhub-logs-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Request Logs</h1>
          <p className="text-zinc-400">{total} total requests</p>
        </div>
        <Button variant="outline" onClick={exportCSV}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={providerFilter} onValueChange={(v) => { setProviderFilter(v); setPage(1) }}>
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
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </CardContent>
        </Card>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ScrollText className="h-12 w-12 text-zinc-600 mb-4" />
            <p className="text-zinc-400">No logs yet. Make API requests to see them here.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Tokens</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Latency</TableHead>
                  <TableHead>Status</TableHead>
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
                    <TableCell className="text-zinc-400 text-xs whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-zinc-300">{log.provider}</TableCell>
                    <TableCell className="text-zinc-300 font-mono text-xs">{log.model}</TableCell>
                    <TableCell className="text-zinc-400">{log.totalTokens.toLocaleString()}</TableCell>
                    <TableCell className="text-zinc-300">{formatCurrency(log.costUsd)}</TableCell>
                    <TableCell className="text-zinc-400">{log.latencyMs}ms</TableCell>
                    <TableCell>
                      <Badge variant={log.status === 'success' ? 'success' : 'destructive'}>
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs text-zinc-500">{log.platformKey.keyPrefix}...</code>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-400">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
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
                  <span className="text-zinc-400">Provider:</span>
                  <span className="ml-2 text-zinc-100">{selectedLog.provider}</span>
                </div>
                <div>
                  <span className="text-zinc-400">Model:</span>
                  <span className="ml-2 text-zinc-100 font-mono">{selectedLog.model}</span>
                </div>
                <div>
                  <span className="text-zinc-400">Status:</span>
                  <Badge className="ml-2" variant={selectedLog.status === 'success' ? 'success' : 'destructive'}>
                    {selectedLog.status}
                  </Badge>
                </div>
                <div>
                  <span className="text-zinc-400">Latency:</span>
                  <span className="ml-2 text-zinc-100">{selectedLog.latencyMs}ms</span>
                </div>
                <div>
                  <span className="text-zinc-400">Prompt Tokens:</span>
                  <span className="ml-2 text-zinc-100">{selectedLog.promptTokens.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-zinc-400">Completion Tokens:</span>
                  <span className="ml-2 text-zinc-100">{selectedLog.completionTokens.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-zinc-400">Cost:</span>
                  <span className="ml-2 text-zinc-100">{formatCurrency(selectedLog.costUsd)}</span>
                </div>
                <div>
                  <span className="text-zinc-400">Time:</span>
                  <span className="ml-2 text-zinc-100">{new Date(selectedLog.createdAt).toLocaleString()}</span>
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
                <h3 className="text-sm font-medium text-zinc-300 mb-1">Prompt</h3>
                <pre className="rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-xs text-zinc-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
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
                  <h3 className="text-sm font-medium text-zinc-300 mb-1">Response</h3>
                  <pre className="rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-xs text-zinc-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
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
