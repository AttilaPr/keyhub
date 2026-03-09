'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { BadgeAlertIcon } from '@/components/ui/badge-alert'
import { RefreshCWIcon } from '@/components/ui/refresh-cw'
import { useAnimatedIcon } from '@/hooks/use-animated-icon'
import { useWidgetPreferences } from '@/hooks/use-widget-preferences'
import type { DashboardData, BudgetData } from '@/types/dashboard'

// Widget components
import { KpiCards } from '@/components/dashboard/widgets/kpi-cards'
import { BudgetProgress } from '@/components/dashboard/widgets/budget-progress'
import { CostForecast } from '@/components/dashboard/widgets/cost-forecast'
import { RequestsChart } from '@/components/dashboard/widgets/requests-chart'
import { DailyCostChart } from '@/components/dashboard/widgets/daily-cost-chart'
import { LatencyChart } from '@/components/dashboard/widgets/latency-chart'
import { ProviderBreakdown } from '@/components/dashboard/widgets/provider-breakdown'
import { RecentActivity } from '@/components/dashboard/widgets/recent-activity'

// Widget system
import { WidgetWrapper } from '@/components/dashboard/widget-wrapper'
import { WidgetPickerDialog } from '@/components/dashboard/widget-picker'
import { WIDGET_REGISTRY } from '@/lib/widget-registry'

const TIME_RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
]

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [budget, setBudget] = useState<BudgetData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState('30')

  const { visibleWidgets, toggleWidget, resetToDefaults, isVisible } = useWidgetPreferences()

  const { iconRef: errorIconRef, handlers: errorHandlers } = useAnimatedIcon()

  function fetchDashboard(signal?: AbortSignal) {
    setLoading(true)
    setError(null)
    Promise.all([
      fetch(`/api/dashboard?days=${days}`, { signal })
        .then((res) => {
          if (!res.ok) throw new Error(`Server error (${res.status})`)
          return res.json()
        }),
      fetch('/api/budget', { signal })
        .then((res) => res.ok ? res.json() : null)
        .catch((e) => {
          if (e instanceof DOMException && e.name === 'AbortError') throw e
          return null
        }),
    ])
      .then(([dashData, budgetData]) => {
        setData(dashData)
        setBudget(budgetData)
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err.message || 'Failed to load dashboard data')
        setData(null)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const controller = new AbortController()
    fetchDashboard(controller.signal)
    return () => controller.abort()
  }, [days])

  // Compute dynamic grid columns for chart row
  const visibleCharts = ['requests-chart', 'daily-cost-chart', 'latency-chart'].filter(id => isVisible(id))
  const chartCols = visibleCharts.length >= 3 ? 'lg:grid-cols-3' : visibleCharts.length === 2 ? 'lg:grid-cols-2' : ''

  // Compute dynamic grid columns for bottom row
  const visibleBottom = ['provider-breakdown', 'recent-activity'].filter(id => isVisible(id))
  const bottomCols = visibleBottom.length === 2 ? 'lg:grid-cols-2' : ''

  // Helper to get widget definition
  function getWidget(id: string) {
    return WIDGET_REGISTRY.find(w => w.id === id)
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">Overview of your AI API usage</p>
          </div>
          <div className="flex items-center gap-2">
            <WidgetPickerDialog visibleWidgets={visibleWidgets} onToggle={toggleWidget} onReset={resetToDefaults} />
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
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-4 w-24 mb-3" />
                <Skeleton className="h-8 w-32" />
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
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">Overview of your AI API usage</p>
          </div>
          <div className="flex items-center gap-2">
            <WidgetPickerDialog visibleWidgets={visibleWidgets} onToggle={toggleWidget} onReset={resetToDefaults} />
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
        </div>
        <Card {...errorHandlers}>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BadgeAlertIcon ref={errorIconRef} size={48} className="text-red-400 mb-4" />
            <p className="text-muted-foreground font-medium mb-1">Failed to load dashboard</p>
            <p className="text-muted-foreground text-sm mb-4">{error || 'An unexpected error occurred'}</p>
            <Button
              variant="outline"
              onClick={() => fetchDashboard()}
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your AI API usage</p>
        </div>
        <div className="flex items-center gap-2">
          <WidgetPickerDialog visibleWidgets={visibleWidgets} onToggle={toggleWidget} onReset={resetToDefaults} />
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
      </div>

      {/* KPI Cards - non-removable */}
      {isVisible('kpi-cards') && (
        <KpiCards data={data} days={days} />
      )}

      {/* Budget Progress */}
      {isVisible('budget-progress') && (
        <WidgetWrapper widgetId="budget-progress" removable={getWidget('budget-progress')!.removable} onRemove={toggleWidget}>
          <BudgetProgress budget={budget} />
        </WidgetWrapper>
      )}

      {/* Cost Forecast */}
      {isVisible('cost-forecast') && (
        <WidgetWrapper widgetId="cost-forecast" removable={getWidget('cost-forecast')!.removable} onRemove={toggleWidget}>
          <CostForecast costForecast={data.costForecast} />
        </WidgetWrapper>
      )}

      {/* Charts Row */}
      {visibleCharts.length > 0 && (
        <div className={`grid gap-4 ${chartCols}`}>
          {isVisible('requests-chart') && (
            <WidgetWrapper widgetId="requests-chart" removable={getWidget('requests-chart')!.removable} onRemove={toggleWidget}>
              <RequestsChart dailyChart={data.dailyChart} />
            </WidgetWrapper>
          )}
          {isVisible('daily-cost-chart') && (
            <WidgetWrapper widgetId="daily-cost-chart" removable={getWidget('daily-cost-chart')!.removable} onRemove={toggleWidget}>
              <DailyCostChart dailyChart={data.dailyChart} />
            </WidgetWrapper>
          )}
          {isVisible('latency-chart') && (
            <WidgetWrapper widgetId="latency-chart" removable={getWidget('latency-chart')!.removable} onRemove={toggleWidget}>
              <LatencyChart dailyChart={data.dailyChart} />
            </WidgetWrapper>
          )}
        </div>
      )}

      {/* Provider Breakdown + Recent Activity */}
      {visibleBottom.length > 0 && (
        <div className={`grid gap-4 ${bottomCols}`}>
          {isVisible('provider-breakdown') && (
            <WidgetWrapper widgetId="provider-breakdown" removable={getWidget('provider-breakdown')!.removable} onRemove={toggleWidget}>
              <ProviderBreakdown providerBreakdown={data.providerBreakdown} days={days} />
            </WidgetWrapper>
          )}
          {isVisible('recent-activity') && (
            <WidgetWrapper widgetId="recent-activity" removable={getWidget('recent-activity')!.removable} onRemove={toggleWidget}>
              <RecentActivity latestRequests={data.latestRequests} />
            </WidgetWrapper>
          )}
        </div>
      )}
    </div>
  )
}
