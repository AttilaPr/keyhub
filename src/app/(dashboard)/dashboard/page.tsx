'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DollarSign, Activity, CheckCircle, TrendingUp } from 'lucide-react'
import { formatCurrency, formatNumber } from '@/lib/utils'
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

interface DashboardData {
  monthSpend: number
  todayRequests: number
  totalRequests: number
  successRate: number
  dailyChart: { date: string; requests: number; cost: number }[]
  providerBreakdown: { provider: string; cost: number; requests: number }[]
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard')
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-zinc-400">Overview of your AI API usage</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!data) return null

  const stats = [
    {
      title: 'Monthly Spend',
      value: formatCurrency(data.monthSpend),
      icon: DollarSign,
      color: 'text-emerald-500',
    },
    {
      title: 'Today\'s Requests',
      value: formatNumber(data.todayRequests),
      icon: Activity,
      color: 'text-blue-500',
    },
    {
      title: 'Total Requests (30d)',
      value: formatNumber(data.totalRequests),
      icon: TrendingUp,
      color: 'text-purple-500',
    },
    {
      title: 'Success Rate',
      value: `${data.successRate}%`,
      icon: CheckCircle,
      color: 'text-emerald-500',
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-zinc-400">Overview of your AI API usage</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Requests per day */}
        <Card>
          <CardHeader>
            <CardTitle className="text-zinc-100">Requests per Day</CardTitle>
          </CardHeader>
          <CardContent>
            {data.dailyChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.dailyChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#71717a', fontSize: 12 }}
                    tickFormatter={(v) => v.slice(5)}
                  />
                  <YAxis tick={{ fill: '#71717a', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#18181b',
                      border: '1px solid #27272a',
                      borderRadius: '8px',
                      color: '#fff',
                    }}
                  />
                  <Bar dataKey="requests" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-zinc-500">
                No data yet. Make some API requests to see charts.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cost per day */}
        <Card>
          <CardHeader>
            <CardTitle className="text-zinc-100">Daily Cost</CardTitle>
          </CardHeader>
          <CardContent>
            {data.dailyChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.dailyChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#71717a', fontSize: 12 }}
                    tickFormatter={(v) => v.slice(5)}
                  />
                  <YAxis
                    tick={{ fill: '#71717a', fontSize: 12 }}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#18181b',
                      border: '1px solid #27272a',
                      borderRadius: '8px',
                      color: '#fff',
                    }}
                    formatter={(value: any) => [`$${Number(value).toFixed(4)}`, 'Cost']}
                  />
                  <Line
                    type="monotone"
                    dataKey="cost"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ fill: '#10b981', r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-zinc-500">
                No data yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Provider Breakdown */}
      {data.providerBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-zinc-100">Cost by Provider (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.providerBreakdown} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis
                  type="number"
                  tick={{ fill: '#71717a', fontSize: 12 }}
                  tickFormatter={(v) => `$${v}`}
                />
                <YAxis
                  dataKey="provider"
                  type="category"
                  tick={{ fill: '#71717a', fontSize: 12 }}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    border: '1px solid #27272a',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                  formatter={(value: any) => [`$${Number(value).toFixed(4)}`, 'Cost']}
                />
                <Bar dataKey="cost" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
