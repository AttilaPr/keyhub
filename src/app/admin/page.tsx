'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { Database } from 'lucide-react'
import { BadgeAlertIcon } from '@/components/ui/badge-alert'
import { RefreshCWIcon } from '@/components/ui/refresh-cw'
import { UsersIcon } from '@/components/ui/users'
import { KeyIcon } from '@/components/ui/key'
import { ScanTextIcon } from '@/components/ui/scan-text'
import { DollarSignIcon } from '@/components/ui/dollar-sign'
import { HeartIcon } from '@/components/ui/heart'
import { LoaderPinwheelIcon } from '@/components/ui/loader-pinwheel'
import { useAnimatedIcon } from '@/hooks/use-animated-icon'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts'
import { useChartTheme } from '@/hooks/use-chart-theme'

interface AdminStats {
  totalUsers: number
  newUsersLast7d: number
  totalProviderKeys: number
  activeProviderKeys: number
  totalPlatformKeys: number
  activePlatformKeys: number
  totalRequests: number
  todayRequests: number
  monthRequests: number
  monthCost: number
  recentUsers: { id: string; email: string; name: string | null; role: string; createdAt: string }[]
  topSpenders: { userId: string; email: string; name: string | null; requests: number; cost: number }[]
  providerBreakdown: { provider: string; requests: number; cost: number }[]
  requestsPerDay: { date: string; count: number }[]
  signupsPerDay: { date: string; count: number }[]
  errorRateByProvider: { provider: string; errorRate: number }[]
  topOrganizations: { orgId: string; name: string; requests: number; cost: number }[]
}

interface HealthData {
  db: { status: 'ok' | 'error'; latencyMs: number }
  providers: Record<string, { status: 'ok' | 'error' | 'unconfigured'; activeKeys: number; recentRequests: number; recentErrors: number }>
  checkedAt: string
}

export default function AdminDashboardPage() {
  const ct = useChartTheme()
  const [data, setData] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [health, setHealth] = useState<HealthData | null>(null)
  const [healthLoading, setHealthLoading] = useState(true)
  const { addToast } = useToast()

  // Animated icon refs for KPI cards
  const { iconRef: usersIconRef, handlers: usersHandlers } = useAnimatedIcon()
  const { iconRef: requestsIconRef, handlers: requestsHandlers } = useAnimatedIcon()
  const { iconRef: keysIconRef, handlers: keysHandlers } = useAnimatedIcon()
  const { iconRef: costIconRef, handlers: costHandlers } = useAnimatedIcon()

  // Animated icon refs for other sections
  const { iconRef: healthIconRef, handlers: healthHandlers } = useAnimatedIcon()

  function fetchData() {
    setLoading(true)
    setError(null)
    fetch('/api/admin/stats')
      .then((res) => {
        if (!res.ok) throw new Error(`Server error (${res.status})`)
        return res.json()
      })
      .then(setData)
      .catch((err) => {
        setError(err.message || 'Failed to load admin stats')
        setData(null)
      })
      .finally(() => setLoading(false))
  }

  function fetchHealth() {
    setHealthLoading(true)
    fetch('/api/admin/health')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setHealth(data) })
      .catch(() => {})
      .finally(() => setHealthLoading(false))
  }

  useEffect(() => { fetchData(); fetchHealth() }, [])

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <BadgeAlertIcon size={40} className="text-red-400" />
            <p className="text-sm text-muted-foreground text-center">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCWIcon size={16} className="mr-2" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-muted-foreground">Platform overview and management</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card {...usersHandlers}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
            <UsersIcon ref={usersIconRef} size={16} className="text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-20" /> : (
              <>
                <div className="text-2xl font-bold text-foreground">
                  {(data?.totalUsers ?? 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">+{data?.newUsersLast7d ?? 0} last 7d</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card {...requestsHandlers}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Requests Today</CardTitle>
            <ScanTextIcon ref={requestsIconRef} size={16} className="text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-20" /> : (
              <>
                <div className="text-2xl font-bold text-foreground">
                  {(data?.todayRequests ?? 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{(data?.monthRequests ?? 0).toLocaleString()} this month</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card {...keysHandlers}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Keys</CardTitle>
            <KeyIcon ref={keysIconRef} size={16} className="text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-20" /> : (
              <>
                <div className="text-2xl font-bold text-foreground">
                  {((data?.activePlatformKeys ?? 0) + (data?.activeProviderKeys ?? 0)).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{data?.activePlatformKeys ?? 0} platform · {data?.activeProviderKeys ?? 0} provider</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card {...costHandlers}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Cost</CardTitle>
            <DollarSignIcon ref={costIconRef} size={16} className="text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-20" /> : (
              <>
                <div className="text-2xl font-bold text-foreground">
                  ${(data?.monthCost ?? 0).toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{data?.totalRequests ?? 0} total requests</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row: Requests Per Day + Signups Per Day */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Requests Per Day Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">Requests Per Day (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : data?.requestsPerDay && data.requestsPerDay.some((d) => d.count > 0) ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.requestsPerDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: ct.tick, fontSize: 11 }}
                    tickFormatter={(v) => v.slice(5)}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fill: ct.tick, fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, borderRadius: '8px', color: ct.tooltipText }}
                    labelFormatter={(label) => label}
                    formatter={(value: any) => [Number(value).toLocaleString(), 'Requests']}
                  />
                  <Bar dataKey="count" fill="#84cc16" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[280px] items-center justify-center text-muted-foreground">No data yet</div>
            )}
          </CardContent>
        </Card>

        {/* Signups Per Day Line Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">New Signups Per Day (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : data?.signupsPerDay && data.signupsPerDay.some((d) => d.count > 0) ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data.signupsPerDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: ct.tick, fontSize: 11 }}
                    tickFormatter={(v) => v.slice(5)}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fill: ct.tick, fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, borderRadius: '8px', color: ct.tooltipText }}
                    labelFormatter={(label) => label}
                    formatter={(value: any) => [Number(value).toLocaleString(), 'Signups']}
                  />
                  <Line type="monotone" dataKey="count" stroke="#a3e635" strokeWidth={2} dot={{ r: 2, fill: '#a3e635' }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[280px] items-center justify-center text-muted-foreground">No data yet</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Error Rate by Provider */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Error Rate by Provider (30d)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : data?.errorRateByProvider && data.errorRateByProvider.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(160, data.errorRateByProvider.length * 50)}>
              <BarChart data={data.errorRateByProvider} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                <XAxis
                  type="number"
                  tick={{ fill: ct.tick, fontSize: 11 }}
                  tickFormatter={(v) => `${v}%`}
                  domain={[0, 'auto']}
                />
                <YAxis
                  type="category"
                  dataKey="provider"
                  tick={{ fill: ct.tick, fontSize: 12 }}
                  width={100}
                  className="capitalize"
                />
                <Tooltip
                  contentStyle={{ backgroundColor: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, borderRadius: '8px', color: ct.tooltipText }}
                  formatter={(value: any) => [`${Number(value).toFixed(2)}%`, 'Error Rate']}
                />
                <Bar dataKey="errorRate" fill="#22d3ee" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[160px] items-center justify-center text-muted-foreground">No data yet</div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Provider Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">Cost by Provider (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : (
              <div className="space-y-3">
                {data?.providerBreakdown.map((p) => (
                  <div key={p.provider} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground/80 capitalize">{p.provider}</p>
                      <p className="text-xs text-muted-foreground">{p.requests.toLocaleString()} requests</p>
                    </div>
                    <span className="text-sm font-mono text-primary">${p.cost.toFixed(4)}</span>
                  </div>
                ))}
                {data?.providerBreakdown.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No data yet</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Spenders */}
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">Top Spenders (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : (
              <div className="space-y-2">
                {data?.topSpenders.map((s, i) => (
                  <div key={s.userId} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-5">#{i + 1}</span>
                      <div>
                        <p className="text-sm text-foreground/80">{s.name || s.email}</p>
                        <p className="text-xs text-muted-foreground">{s.requests.toLocaleString()} requests</p>
                      </div>
                    </div>
                    <span className="text-sm font-mono text-primary">${s.cost.toFixed(4)}</span>
                  </div>
                ))}
                {data?.topSpenders.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No data yet</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Organizations by Spend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Top Organizations by Spend (30d)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : (
            <div className="space-y-2">
              {data?.topOrganizations?.map((org, i) => (
                <div key={org.orgId} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-5">#{i + 1}</span>
                    <div>
                      <p className="text-sm text-foreground/80">{org.name}</p>
                      <p className="text-xs text-muted-foreground">{org.requests.toLocaleString()} requests</p>
                    </div>
                  </div>
                  <span className="text-sm font-mono text-primary">${org.cost.toFixed(4)}</span>
                </div>
              ))}
              {(!data?.topOrganizations || data.topOrganizations.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">No data yet</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Users */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Recent Signups</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <div className="space-y-2">
              {data?.recentUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{user.name || 'Unnamed'}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={user.role === 'SUPER_ADMIN' ? 'bg-red-500/10 text-red-400' : 'bg-card text-muted-foreground'}>
                      {user.role}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
              {data?.recentUsers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No users yet</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Health Panel */}
      <Card {...healthHandlers}>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <HeartIcon ref={healthIconRef} size={20} className="text-primary" />
            <CardTitle className="text-foreground">System Health</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchHealth} disabled={healthLoading}>
            {healthLoading ? <LoaderPinwheelIcon size={16} className="animate-spin" /> : <RefreshCWIcon size={16} />}
          </Button>
        </CardHeader>
        <CardContent>
          {healthLoading && !health ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : health ? (
            <div className="space-y-4">
              {/* Database */}
              <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                <div className="flex items-center gap-3">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground/80">Database (PostgreSQL)</p>
                    <p className="text-xs text-muted-foreground">Latency: {health.db.latencyMs}ms</p>
                  </div>
                </div>
                <Badge className={
                  health.db.status === 'ok'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-red-500/10 text-red-400'
                }>
                  {health.db.status === 'ok' ? 'Healthy' : 'Error'}
                </Badge>
              </div>

              {/* AI Providers */}
              {Object.entries(health.providers).map(([provider, info]) => (
                <div key={provider} className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                  <div className="flex items-center gap-3">
                    <KeyIcon size={16} className="text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground/80 capitalize">{provider}</p>
                      <p className="text-xs text-muted-foreground">
                        {info.activeKeys} active {info.activeKeys === 1 ? 'key' : 'keys'}
                        {info.recentRequests > 0 && (
                          <> &middot; {info.recentRequests.toLocaleString()} requests (24h)</>
                        )}
                        {info.recentErrors > 0 && (
                          <> &middot; {info.recentErrors.toLocaleString()} errors</>
                        )}
                      </p>
                    </div>
                  </div>
                  <Badge className={
                    info.status === 'ok'
                      ? 'bg-primary/10 text-primary'
                      : info.status === 'unconfigured'
                        ? 'bg-card text-muted-foreground'
                        : 'bg-red-500/10 text-red-400'
                  }>
                    {info.status === 'ok' ? 'Healthy' : info.status === 'unconfigured' ? 'Not Configured' : 'Error'}
                  </Badge>
                </div>
              ))}

              {health.checkedAt && (
                <p className="text-xs text-muted-foreground text-right">
                  Last checked: {new Date(health.checkedAt).toLocaleTimeString()}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Failed to load health data</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
