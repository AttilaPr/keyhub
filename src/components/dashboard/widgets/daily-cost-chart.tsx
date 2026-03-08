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

interface DailyCostChartProps {
  dailyChart: DashboardData['dailyChart']
}

export function DailyCostChart({ dailyChart }: DailyCostChartProps) {
  const ct = useChartTheme()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground">Daily Cost</CardTitle>
      </CardHeader>
      <CardContent>
        {dailyChart.length > 0 ? (
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
                tickFormatter={(v) => `$${v}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: ct.tooltipBg,
                  border: `1px solid ${ct.tooltipBorder}`,
                  borderRadius: '8px',
                  color: ct.tooltipText,
                }}
                formatter={(value: any) => [`$${Number(value).toFixed(4)}`, 'Cost']}
              />
              <Line
                type="monotone"
                dataKey="cost"
                stroke="#a3e635"
                strokeWidth={2}
                dot={{ fill: '#a3e635', r: 3 }}
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
