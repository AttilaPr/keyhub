'use client'

import { useEffect, useState } from 'react'
import { useOrgs } from '@/contexts/orgs-context'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tag, Lightbulb } from 'lucide-react'
import { BadgeAlertIcon } from '@/components/ui/badge-alert'
import { RefreshCWIcon } from '@/components/ui/refresh-cw'
import { useAnimatedIcon } from '@/hooks/use-animated-icon'
import { formatCurrency } from '@/lib/utils'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  AreaChart,
  Area,
} from 'recharts'
import { useChartTheme } from '@/hooks/use-chart-theme'

interface DashboardData {
  monthSpend: number
  todayRequests: number
  totalRequests: number
  successRate: number
  totalTokens: number
  promptTokens: number
  completionTokens: number
  latencyPercentiles: { p50: number; p90: number; p95: number; p99: number; count: number }
  dailyChart: { date: string; requests: number; cost: number; tokens: number; promptTokens: number; completionTokens: number }[]
  providerBreakdown: { provider: string; cost: number; requests: number }[]
  modelBreakdown: { provider: string; model: string; cost: number; tokens: number; requests: number; avgLatency: number; errorRate: number }[]
  keyBreakdown: { label: string; keyPrefix: string; cost: number; tokens: number; requests: number }[]
}

interface TagBreakdownItem {
  tag: string
  requests: number
  cost: number
  avgLatency: number
}

interface WhatIfData {
  totalRequests: number
  actualCost: number
  cheapestCost: number
  savings: number
  savingsPercent: number
  modelBreakdown: {
    model: string
    provider: string
    requests: number
    actualCost: number
    cheapestCost: number
    cheapestModel: string
    savings: number
  }[]
}

const COLORS = ['#84cc16', '#a3e635', '#22d3ee', '#facc15', '#4ade80']

const TIME_RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
]

export default function UsagePage() {
  const { activeOrgId } = useOrgs()
  const ct = useChartTheme()
  const { iconRef: errorIconRef, handlers: errorHandlers } = useAnimatedIcon()
  const [data, setData] = useState<DashboardData | null>(null)
  const [tagData, setTagData] = useState<TagBreakdownItem[]>([])
  const [whatIfData, setWhatIfData] = useState<WhatIfData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState('30')

  function fetchUsage(signal?: AbortSignal) {
    setLoading(true)
    setError(null)
    Promise.all([
      fetch(`/api/dashboard?days=${days}`, { signal })
        .then((res) => {
          if (!res.ok) throw new Error(`Server error (${res.status})`)
          return res.json()
        }),
      fetch(`/api/usage?days=${days}`, { signal })
        .then((res) => res.ok ? res.json() : null)
        .catch((e) => {
          if (e instanceof DOMException && e.name === 'AbortError') throw e
          return null
        }),
      fetch('/api/usage/what-if?limit=1000', { signal })
        .then((res) => res.ok ? res.json() : null)
        .catch((e) => {
          if (e instanceof DOMException && e.name === 'AbortError') throw e
          return null
        }),
    ])
      .then(([dashData, usageData, whatIf]) => {
        setData(dashData)
        setTagData(usageData?.tagBreakdown || [])
        setWhatIfData(whatIf)
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err.message || 'Failed to load usage data')
        setData(null)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const controller = new AbortController()
    fetchUsage(controller.signal)
    return () => controller.abort()
  }, [days, activeOrgId])

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Usage & Metrics</h1>
            <p className="text-muted-foreground">Detailed spend and usage analytics</p>
          </div>
          <Select value={days} onValueChange={(v) => v && setDays(v)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_RANGES.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-[300px] w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Usage & Metrics</h1>
            <p className="text-muted-foreground">Detailed spend and usage analytics</p>
          </div>
          <Select value={days} onValueChange={(v) => v && setDays(v)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_RANGES.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Card {...errorHandlers}>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <span className="text-red-400 mb-4"><BadgeAlertIcon ref={errorIconRef} size={48} /></span>
            <p className="text-muted-foreground font-medium mb-1">Failed to load usage data</p>
            <p className="text-muted-foreground text-sm mb-4">{error || 'An unexpected error occurred'}</p>
            <Button
              variant="outline"
              onClick={() => fetchUsage()}
              className="gap-2"
            >
              <RefreshCWIcon size={16} />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Usage & Metrics</h1>
          <p className="text-muted-foreground">Detailed spend and usage analytics</p>
        </div>
        <Select value={days} onValueChange={(v) => v && setDays(v)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_RANGES.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Spend Over Time */}
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">Spend Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            {data.dailyChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.dailyChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis dataKey="date" tick={{ fill: ct.tick, fontSize: 12 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fill: ct.tick, fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, borderRadius: '8px', color: ct.tooltipText }}
                    formatter={(value: any) => [`$${Number(value).toFixed(6)}`, 'Cost']}
                  />
                  <Line type="monotone" dataKey="cost" stroke="#a3e635" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">No data yet.</div>
            )}
          </CardContent>
        </Card>

        {/* Requests Per Day */}
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">Requests Per Day</CardTitle>
          </CardHeader>
          <CardContent>
            {data.dailyChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.dailyChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis dataKey="date" tick={{ fill: ct.tick, fontSize: 12 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fill: ct.tick, fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, borderRadius: '8px', color: ct.tooltipText }}
                  />
                  <Bar dataKey="requests" fill="#84cc16" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">No data yet.</div>
            )}
          </CardContent>
        </Card>

        {/* Tokens Per Day */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-foreground">Tokens per Day</CardTitle>
              {data.totalTokens > 0 && (
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Total: <span className="text-foreground font-medium">{data.totalTokens.toLocaleString()}</span></span>
                  <span>Input: <span className="text-cyan-600 dark:text-cyan-400">{data.promptTokens.toLocaleString()}</span></span>
                  <span>Output: <span className="text-primary">{data.completionTokens.toLocaleString()}</span></span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {data.dailyChart.some(d => d.tokens > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={data.dailyChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis dataKey="date" tick={{ fill: ct.tick, fontSize: 12 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fill: ct.tick, fontSize: 12 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                  <Tooltip
                    contentStyle={{ backgroundColor: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, borderRadius: '8px', color: ct.tooltipText }}
                    formatter={(value: any, name: string) => [
                      Number(value).toLocaleString(),
                      name === 'promptTokens' ? 'Input Tokens' : name === 'completionTokens' ? 'Output Tokens' : 'Tokens',
                    ]}
                  />
                  <Legend formatter={(value: string) => value === 'promptTokens' ? 'Input' : 'Output'} />
                  <Area type="monotone" dataKey="promptTokens" stackId="1" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.3} />
                  <Area type="monotone" dataKey="completionTokens" stackId="1" stroke="#a3e635" fill="#a3e635" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">No data yet.</div>
            )}
          </CardContent>
        </Card>

        {/* Cost by Provider Pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">Cost by Provider</CardTitle>
          </CardHeader>
          <CardContent>
            {data.providerBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={data.providerBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={4}
                    dataKey="cost"
                    nameKey="provider"
                    label={({ name, value }: any) => `${name}: $${Number(value).toFixed(4)}`}
                  >
                    {data.providerBreakdown.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, borderRadius: '8px', color: ct.tooltipText }}
                    formatter={(value: any) => [`$${Number(value).toFixed(6)}`, 'Cost']}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">No data yet.</div>
            )}
          </CardContent>
        </Card>

        {/* Requests by Provider */}
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">Requests by Provider</CardTitle>
          </CardHeader>
          <CardContent>
            {data.providerBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.providerBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis dataKey="provider" tick={{ fill: ct.tick, fontSize: 12 }} />
                  <YAxis tick={{ fill: ct.tick, fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, borderRadius: '8px', color: ct.tooltipText }}
                  />
                  <Bar dataKey="requests" fill="#65a30d" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">No data yet.</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Latency Distribution */}
      {data.latencyPercentiles && data.latencyPercentiles.count > 0 && (() => {
        const pcts = data.latencyPercentiles
        const max = pcts.p99 || 1
        const items = [
          { label: 'P50', value: pcts.p50, color: '#84cc16' },
          { label: 'P90', value: pcts.p90, color: '#a3e635' },
          { label: 'P95', value: pcts.p95, color: '#facc15' },
          { label: 'P99', value: pcts.p99, color: '#22d3ee' },
        ]
        return (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-foreground">Latency Distribution</CardTitle>
                <span className="text-xs text-muted-foreground">{pcts.count.toLocaleString()} requests</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground font-medium">{item.label}</span>
                      <span className="text-foreground font-mono">{item.value.toLocaleString()}ms</span>
                    </div>
                    <div className="h-2 rounded-full bg-card">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.max(2, (item.value / max) * 100)}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )
      })()}

      {/* Cost Table */}
      {data.providerBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">Provider Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">Provider</th>
                    <th className="text-right py-3 px-4 text-muted-foreground font-medium">Requests</th>
                    <th className="text-right py-3 px-4 text-muted-foreground font-medium">Total Cost</th>
                    <th className="text-right py-3 px-4 text-muted-foreground font-medium">Avg Cost/Request</th>
                  </tr>
                </thead>
                <tbody>
                  {data.providerBreakdown.map((p) => (
                    <tr key={p.provider} className="border-b border-border/50">
                      <td className="py-3 px-4 text-foreground capitalize">{p.provider}</td>
                      <td className="py-3 px-4 text-right text-muted-foreground">{p.requests.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right text-muted-foreground">{formatCurrency(p.cost)}</td>
                      <td className="py-3 px-4 text-right text-muted-foreground">
                        {p.requests > 0 ? formatCurrency(p.cost / p.requests) : '$0.00'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cost by Model */}
      {data.modelBreakdown && data.modelBreakdown.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">Cost by Model</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={Math.max(300, data.modelBreakdown.length * 40)}>
                <BarChart data={data.modelBreakdown} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis type="number" tick={{ fill: ct.tick, fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                  <YAxis type="category" dataKey="model" tick={{ fill: ct.tick, fontSize: 11 }} width={160} />
                  <Tooltip
                    contentStyle={{ backgroundColor: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, borderRadius: '8px', color: ct.tooltipText }}
                    formatter={(value: any) => [`$${Number(value).toFixed(6)}`, 'Cost']}
                    labelFormatter={(label: string) => {
                      const item = data.modelBreakdown.find((m) => m.model === label)
                      return item ? `${item.provider}/${item.model}` : label
                    }}
                  />
                  <Bar dataKey="cost" radius={[0, 4, 4, 0]}>
                    {data.modelBreakdown.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">Model Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">Model</th>
                      <th className="text-right py-3 px-4 text-muted-foreground font-medium">Requests</th>
                      <th className="text-right py-3 px-4 text-muted-foreground font-medium">Avg Latency</th>
                      <th className="text-right py-3 px-4 text-muted-foreground font-medium">Error Rate</th>
                      <th className="text-right py-3 px-4 text-muted-foreground font-medium">Avg Cost/Req</th>
                      <th className="text-right py-3 px-4 text-muted-foreground font-medium">Total Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.modelBreakdown.map((m) => (
                      <tr key={`${m.provider}-${m.model}`} className="border-b border-border/50">
                        <td className="py-3 px-4">
                          <div className="text-foreground font-mono text-xs">{m.model}</div>
                          <span className="text-xs text-muted-foreground capitalize">{m.provider}</span>
                        </td>
                        <td className="py-3 px-4 text-right text-muted-foreground">{m.requests.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right text-cyan-600 dark:text-cyan-400">
                          {m.avgLatency > 0 ? `${m.avgLatency.toLocaleString()}ms` : '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={m.errorRate > 0 ? 'text-red-400' : 'text-muted-foreground'}>
                            {m.errorRate}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-muted-foreground">
                          {m.requests > 0 ? formatCurrency(m.cost / m.requests) : '—'}
                        </td>
                        <td className="py-3 px-4 text-right text-muted-foreground">{formatCurrency(m.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Usage by API Key */}
      {data.keyBreakdown && data.keyBreakdown.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">Cost by API Key</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.keyBreakdown} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis type="number" tick={{ fill: ct.tick, fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                  <YAxis type="category" dataKey="label" tick={{ fill: ct.tick, fontSize: 12 }} width={120} />
                  <Tooltip
                    contentStyle={{ backgroundColor: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, borderRadius: '8px', color: ct.tooltipText }}
                    formatter={(value: any) => [`$${Number(value).toFixed(6)}`, 'Cost']}
                  />
                  <Bar dataKey="cost" fill="#a3e635" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">API Key Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">Key</th>
                      <th className="text-right py-3 px-4 text-muted-foreground font-medium">Requests</th>
                      <th className="text-right py-3 px-4 text-muted-foreground font-medium">Tokens</th>
                      <th className="text-right py-3 px-4 text-muted-foreground font-medium">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.keyBreakdown.map((k) => (
                      <tr key={k.keyPrefix} className="border-b border-border/50">
                        <td className="py-3 px-4">
                          <div className="text-foreground">{k.label}</div>
                          <code className="text-xs text-muted-foreground">{k.keyPrefix}...</code>
                        </td>
                        <td className="py-3 px-4 text-right text-muted-foreground">{k.requests.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right text-muted-foreground">{k.tokens.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right text-muted-foreground">{formatCurrency(k.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* By Tag Breakdown */}
      {tagData.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              <CardTitle className="text-foreground">Usage by Tag</CardTitle>
            </div>
            <CardDescription>
              Breakdown of requests tagged via the X-KeyHub-Tag header
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <ResponsiveContainer width="100%" height={Math.max(200, tagData.length * 40)}>
                  <BarChart data={tagData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                    <XAxis type="number" tick={{ fill: ct.tick, fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                    <YAxis type="category" dataKey="tag" tick={{ fill: ct.tick, fontSize: 12 }} width={120} />
                    <Tooltip
                      contentStyle={{ backgroundColor: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, borderRadius: '8px', color: ct.tooltipText }}
                      formatter={(value: any) => [`$${Number(value).toFixed(6)}`, 'Cost']}
                    />
                    <Bar dataKey="cost" radius={[0, 4, 4, 0]}>
                      {tagData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">Tag</th>
                      <th className="text-right py-3 px-4 text-muted-foreground font-medium">Requests</th>
                      <th className="text-right py-3 px-4 text-muted-foreground font-medium">Total Cost</th>
                      <th className="text-right py-3 px-4 text-muted-foreground font-medium">Avg Latency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tagData.map((t) => (
                      <tr key={t.tag} className="border-b border-border/50">
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="font-mono text-xs">
                            {t.tag}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right text-muted-foreground">{t.requests.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right text-muted-foreground">{formatCurrency(t.cost)}</td>
                        <td className="py-3 px-4 text-right text-cyan-600 dark:text-cyan-400">
                          {t.avgLatency > 0 ? `${t.avgLatency.toLocaleString()}ms` : '--'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* What-if Analysis */}
      {whatIfData && whatIfData.totalRequests > 0 && whatIfData.savings > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-yellow-400" />
              <CardTitle className="text-foreground">What-if Analysis</CardTitle>
            </div>
            <CardDescription>
              Compare actual costs vs using the cheapest model per provider (based on last {whatIfData.totalRequests.toLocaleString()} requests)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 lg:grid-cols-3 mb-6">
              <div className="rounded-lg bg-muted/50 border border-border p-4">
                <div className="text-xs text-muted-foreground mb-1">Actual Cost</div>
                <div className="text-xl font-bold text-foreground">{formatCurrency(whatIfData.actualCost)}</div>
              </div>
              <div className="rounded-lg bg-muted/50 border border-border p-4">
                <div className="text-xs text-muted-foreground mb-1">Cheapest Alternative</div>
                <div className="text-xl font-bold text-primary">{formatCurrency(whatIfData.cheapestCost)}</div>
              </div>
              <div className="rounded-lg bg-muted/50 border border-border p-4">
                <div className="text-xs text-muted-foreground mb-1">Potential Savings</div>
                <div className="text-xl font-bold text-yellow-400">
                  {formatCurrency(whatIfData.savings)}
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    ({whatIfData.savingsPercent}%)
                  </span>
                </div>
              </div>
            </div>

            {whatIfData.modelBreakdown.filter((m) => m.savings > 0).length > 0 && (
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <ResponsiveContainer width="100%" height={Math.max(200, whatIfData.modelBreakdown.filter((m) => m.savings > 0).length * 45)}>
                    <BarChart
                      data={whatIfData.modelBreakdown.filter((m) => m.savings > 0)}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                      <XAxis type="number" tick={{ fill: ct.tick, fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                      <YAxis type="category" dataKey="model" tick={{ fill: ct.tick, fontSize: 11 }} width={160} />
                      <Tooltip
                        contentStyle={{ backgroundColor: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, borderRadius: '8px', color: ct.tooltipText }}
                        formatter={(value: any, name: string) => [
                          `$${Number(value).toFixed(6)}`,
                          name === 'actualCost' ? 'Actual Cost' : name === 'cheapestCost' ? 'Cheapest Cost' : 'Savings',
                        ]}
                      />
                      <Legend
                        formatter={(value: string) =>
                          value === 'actualCost' ? 'Actual' : value === 'cheapestCost' ? 'Cheapest' : value
                        }
                      />
                      <Bar dataKey="actualCost" fill="#84cc16" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="cheapestCost" fill="#22d3ee" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium">Model</th>
                        <th className="text-right py-3 px-4 text-muted-foreground font-medium">Actual Cost</th>
                        <th className="text-right py-3 px-4 text-muted-foreground font-medium">Cheapest Alt.</th>
                        <th className="text-right py-3 px-4 text-muted-foreground font-medium">Savings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {whatIfData.modelBreakdown.map((m) => (
                        <tr key={`${m.provider}-${m.model}`} className="border-b border-border/50">
                          <td className="py-3 px-4">
                            <div className="text-foreground font-mono text-xs">{m.model}</div>
                            <div className="text-xs text-muted-foreground">
                              <span className="capitalize">{m.provider}</span>
                              {m.model !== m.cheapestModel && (
                                <span className="text-cyan-600 dark:text-cyan-400 ml-1">
                                  (alt: {m.cheapestModel})
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right text-muted-foreground">{formatCurrency(m.actualCost)}</td>
                          <td className="py-3 px-4 text-right text-cyan-600 dark:text-cyan-400">{formatCurrency(m.cheapestCost)}</td>
                          <td className="py-3 px-4 text-right">
                            <span className={m.savings > 0 ? 'text-yellow-400' : 'text-muted-foreground'}>
                              {m.savings > 0 ? formatCurrency(m.savings) : '--'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
