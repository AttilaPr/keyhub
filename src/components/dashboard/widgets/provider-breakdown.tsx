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

interface ProviderBreakdownProps {
  providerBreakdown: DashboardData['providerBreakdown']
  days: string
}

export function ProviderBreakdown({ providerBreakdown, days }: ProviderBreakdownProps) {
  const ct = useChartTheme()

  if (providerBreakdown.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground">Cost by Provider ({days}d)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={providerBreakdown} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
            <XAxis
              type="number"
              tick={{ fill: ct.tick, fontSize: 12 }}
              tickFormatter={(v) => `$${v}`}
            />
            <YAxis
              dataKey="provider"
              type="category"
              tick={{ fill: ct.tick, fontSize: 12 }}
              width={80}
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
            <Bar dataKey="cost" fill="#65a30d" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
