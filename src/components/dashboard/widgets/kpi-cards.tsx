'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSignIcon } from '@/components/ui/dollar-sign'
import { ActivityIcon } from '@/components/ui/activity'
import { TrendingUpIcon } from '@/components/ui/trending-up'
import { CircleCheckIcon } from '@/components/ui/circle-check'
import { TimerIcon } from '@/components/ui/timer'
import { useAnimatedIcon } from '@/hooks/use-animated-icon'
import { formatCurrency, formatNumber } from '@/lib/utils'
import type { DashboardData } from '@/types/dashboard'

interface KpiCardsProps {
  data: DashboardData
  days: string
}

export function KpiCards({ data, days }: KpiCardsProps) {
  const { iconRef: spendIconRef, handlers: spendHandlers } = useAnimatedIcon()
  const { iconRef: todayIconRef, handlers: todayHandlers } = useAnimatedIcon()
  const { iconRef: totalIconRef, handlers: totalHandlers } = useAnimatedIcon()
  const { iconRef: successIconRef, handlers: successHandlers } = useAnimatedIcon()
  const { iconRef: latencyIconRef, handlers: latencyHandlers } = useAnimatedIcon()

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <Card {...spendHandlers}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Monthly Spend
          </CardTitle>
          <DollarSignIcon ref={spendIconRef} size={16} className="text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">{formatCurrency(data.monthSpend)}</div>
        </CardContent>
      </Card>

      <Card {...todayHandlers}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Today&apos;s Requests
          </CardTitle>
          <ActivityIcon ref={todayIconRef} size={16} className="text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">{formatNumber(data.todayRequests)}</div>
        </CardContent>
      </Card>

      <Card {...totalHandlers}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Requests ({days}d)
          </CardTitle>
          <TrendingUpIcon ref={totalIconRef} size={16} className="text-cyan-600 dark:text-cyan-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">{formatNumber(data.totalRequests)}</div>
        </CardContent>
      </Card>

      <Card {...successHandlers}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Success Rate
          </CardTitle>
          <CircleCheckIcon ref={successIconRef} size={16} className="text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">{data.successRate}%</div>
        </CardContent>
      </Card>

      <Card {...latencyHandlers}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Avg Latency ({days}d)
          </CardTitle>
          <TimerIcon ref={latencyIconRef} size={16} className="text-cyan-600 dark:text-cyan-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">{data.avgLatency > 0 ? `${data.avgLatency}ms` : 'N/A'}</div>
        </CardContent>
      </Card>
    </div>
  )
}
