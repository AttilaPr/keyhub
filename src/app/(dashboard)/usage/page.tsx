'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
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
} from 'recharts'

interface DashboardData {
  monthSpend: number
  todayRequests: number
  totalRequests: number
  successRate: number
  dailyChart: { date: string; requests: number; cost: number }[]
  providerBreakdown: { provider: string; cost: number; requests: number }[]
}

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444']

export default function UsagePage() {
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
          <h1 className="text-2xl font-bold text-white">Usage & Metrics</h1>
          <p className="text-zinc-400">Detailed spend and usage analytics</p>
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

  if (!data) return null

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Usage & Metrics</h1>
        <p className="text-zinc-400">Detailed spend and usage analytics</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Spend Over Time */}
        <Card>
          <CardHeader>
            <CardTitle className="text-zinc-100">Spend Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            {data.dailyChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.dailyChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 12 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff' }}
                    formatter={(value: any) => [`$${Number(value).toFixed(6)}`, 'Cost']}
                  />
                  <Line type="monotone" dataKey="cost" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-zinc-500">No data yet.</div>
            )}
          </CardContent>
        </Card>

        {/* Requests Per Day */}
        <Card>
          <CardHeader>
            <CardTitle className="text-zinc-100">Requests Per Day</CardTitle>
          </CardHeader>
          <CardContent>
            {data.dailyChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.dailyChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 12 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff' }}
                  />
                  <Bar dataKey="requests" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-zinc-500">No data yet.</div>
            )}
          </CardContent>
        </Card>

        {/* Cost by Provider Pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-zinc-100">Cost by Provider</CardTitle>
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
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff' }}
                    formatter={(value: any) => [`$${Number(value).toFixed(6)}`, 'Cost']}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-zinc-500">No data yet.</div>
            )}
          </CardContent>
        </Card>

        {/* Requests by Provider */}
        <Card>
          <CardHeader>
            <CardTitle className="text-zinc-100">Requests by Provider</CardTitle>
          </CardHeader>
          <CardContent>
            {data.providerBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.providerBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="provider" tick={{ fill: '#71717a', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff' }}
                  />
                  <Bar dataKey="requests" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-zinc-500">No data yet.</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cost Table */}
      {data.providerBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-zinc-100">Provider Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left py-3 px-4 text-zinc-400 font-medium">Provider</th>
                    <th className="text-right py-3 px-4 text-zinc-400 font-medium">Requests</th>
                    <th className="text-right py-3 px-4 text-zinc-400 font-medium">Total Cost</th>
                    <th className="text-right py-3 px-4 text-zinc-400 font-medium">Avg Cost/Request</th>
                  </tr>
                </thead>
                <tbody>
                  {data.providerBreakdown.map((p) => (
                    <tr key={p.provider} className="border-b border-zinc-800/50">
                      <td className="py-3 px-4 text-zinc-100 capitalize">{p.provider}</td>
                      <td className="py-3 px-4 text-right text-zinc-300">{p.requests.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right text-zinc-300">{formatCurrency(p.cost)}</td>
                      <td className="py-3 px-4 text-right text-zinc-400">
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
    </div>
  )
}
