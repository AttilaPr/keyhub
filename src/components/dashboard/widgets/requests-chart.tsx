'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useChartTheme } from '@/hooks/use-chart-theme'
import type { DashboardData } from '@/types/dashboard'

interface RequestsChartProps {
  dailyChart: DashboardData['dailyChart']
}

export function RequestsChart({ dailyChart }: RequestsChartProps) {
  const ct = useChartTheme()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground">Requests per Day</CardTitle>
      </CardHeader>
      <CardContent>
        {dailyChart.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dailyChart}>
              <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
              <XAxis
                dataKey="date"
                tick={{ fill: ct.tick, fontSize: 12 }}
                tickFormatter={(v) => v.slice(5)}
              />
              <YAxis tick={{ fill: ct.tick, fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: ct.tooltipBg,
                  border: `1px solid ${ct.tooltipBorder}`,
                  borderRadius: '8px',
                  color: ct.tooltipText,
                }}
              />
              <Bar dataKey="requests" fill="#84cc16" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            No data yet. Make some API requests to see charts.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
