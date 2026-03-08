'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useChartTheme } from '@/hooks/use-chart-theme'
import type { DashboardData } from '@/types/dashboard'

interface LatencyChartProps {
  dailyChart: DashboardData['dailyChart']
}

export function LatencyChart({ dailyChart }: LatencyChartProps) {
  const ct = useChartTheme()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground">Avg Latency per Day</CardTitle>
      </CardHeader>
      <CardContent>
        {dailyChart.some(d => d.avgLatency > 0) ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyChart}>
              <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
              <XAxis
                dataKey="date"
                tick={{ fill: ct.tick, fontSize: 12 }}
                tickFormatter={(v) => v.slice(5)}
              />
              <YAxis
                tick={{ fill: ct.tick, fontSize: 12 }}
                tickFormatter={(v) => `${v}ms`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: ct.tooltipBg,
                  border: `1px solid ${ct.tooltipBorder}`,
                  borderRadius: '8px',
                  color: ct.tooltipText,
                }}
                formatter={(value: any) => [`${Number(value).toLocaleString()}ms`, 'Avg Latency']}
              />
              <Line
                type="monotone"
                dataKey="avgLatency"
                stroke="#22d3ee"
                strokeWidth={2}
                dot={{ fill: '#22d3ee', r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            No data yet.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
