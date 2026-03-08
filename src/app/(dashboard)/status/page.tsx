'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { XCircle } from 'lucide-react'
import { ActivityIcon } from '@/components/ui/activity'
import { ClockIcon } from '@/components/ui/clock'
import { BadgeAlertIcon } from '@/components/ui/badge-alert'
import { CircleCheckIcon } from '@/components/ui/circle-check'
import { RefreshCWIcon } from '@/components/ui/refresh-cw'
import { Button } from '@/components/ui/button'

interface ProviderStatus {
  provider: string
  successRate: number
  avgLatency: number
  requestCount: number
  lastErrorAt: string | null
}

interface StatusData {
  providers: ProviderStatus[]
  periodStart: string
  periodEnd: string
}

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  mistral: 'Mistral',
}

function getStatusColor(rate: number): string {
  if (rate >= 99) return 'text-primary'
  if (rate >= 95) return 'text-yellow-400'
  return 'text-red-400'
}

function getStatusBg(rate: number): string {
  if (rate >= 99) return 'bg-primary/10'
  if (rate >= 95) return 'bg-yellow-400/10'
  return 'bg-red-400/10'
}

function getStatusIcon(rate: number) {
  if (rate >= 99) return <CircleCheckIcon size={20} />
  if (rate >= 95) return <BadgeAlertIcon size={20} />
  return <XCircle className="h-5 w-5 text-red-400" />
}

function getStatusLabel(rate: number): string {
  if (rate >= 99) return 'Healthy'
  if (rate >= 95) return 'Degraded'
  return 'Issues'
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function StatusPage() {
  const [data, setData] = useState<StatusData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/status')
      if (res.ok) {
        const json = await res.json()
        setData(json)
        setLastRefresh(new Date())
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 30_000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  const allHealthy = data?.providers.every((p) => p.successRate >= 99) ?? true

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Status</h1>
          <p className="text-muted-foreground">Provider health over the last 24 hours</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Auto-refreshes every 30s
          </span>
          <Button variant="outline" size="sm" onClick={fetchStatus} disabled={loading}>
            <RefreshCWIcon size={14} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overall status banner */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            {allHealthy ? (
              <CircleCheckIcon size={24} />
            ) : (
              <BadgeAlertIcon size={24} />
            )}
            <div>
              <p className="text-sm font-medium text-foreground">
                {allHealthy ? 'All systems operational' : 'Some providers are experiencing issues'}
              </p>
              <p className="text-xs text-muted-foreground">
                Last updated: {lastRefresh.toLocaleTimeString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="py-6">
                <div className="h-24 animate-pulse rounded bg-card" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : data?.providers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ActivityIcon size={32} className="mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No request data in the last 24 hours</p>
            <p className="text-xs text-muted-foreground mt-1">Make some API calls to see provider status here</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {data?.providers.map((p) => (
            <Card key={p.provider}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(p.successRate)}
                    <div>
                      <CardTitle className="text-foreground">
                        {PROVIDER_LABELS[p.provider] || p.provider}
                      </CardTitle>
                      <CardDescription>{p.requestCount} requests</CardDescription>
                    </div>
                  </div>
                  <Badge className={`${getStatusBg(p.successRate)} ${getStatusColor(p.successRate)}`}>
                    {getStatusLabel(p.successRate)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Success Rate</p>
                    <p className={`text-lg font-semibold ${getStatusColor(p.successRate)}`}>
                      {p.successRate}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Avg Latency</p>
                    <p className="text-lg font-semibold text-foreground">
                      {p.avgLatency < 1000
                        ? `${p.avgLatency}ms`
                        : `${(p.avgLatency / 1000).toFixed(1)}s`}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Last Error</p>
                    <p className="text-sm text-muted-foreground">
                      {p.lastErrorAt ? (
                        <span className="flex items-center gap-1">
                          <ClockIcon size={14} />
                          {formatTimeAgo(p.lastErrorAt)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">None</span>
                      )}
                    </p>
                  </div>
                </div>
                {/* Success rate bar */}
                <div className="mt-4">
                  <div className="h-1.5 w-full rounded-full bg-card">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        p.successRate >= 99
                          ? 'bg-primary'
                          : p.successRate >= 95
                            ? 'bg-yellow-400'
                            : 'bg-red-400'
                      }`}
                      style={{ width: `${Math.min(100, p.successRate)}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
