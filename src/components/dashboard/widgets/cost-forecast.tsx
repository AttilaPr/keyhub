'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Target } from 'lucide-react'
import { TrendingUpIcon } from '@/components/ui/trending-up'
import { TrendingDownIcon } from '@/components/ui/trending-down'
import { CircleCheckIcon } from '@/components/ui/circle-check'
import { useAnimatedIcon } from '@/hooks/use-animated-icon'
import { formatCurrency } from '@/lib/utils'
import type { CostForecast as CostForecastType } from '@/types/dashboard'

interface CostForecastProps {
  costForecast: CostForecastType | null
}

export function CostForecast({ costForecast }: CostForecastProps) {
  const { iconRef: forecastIconRef, handlers: forecastHandlers } = useAnimatedIcon()

  if (!costForecast) return null

  return (
    <Card {...forecastHandlers}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Target className="h-4 w-4" />
          Projected Month-End Spend
        </CardTitle>
        <span className="text-xs text-muted-foreground">
          Confidence: {costForecast.confidence}%
        </span>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="text-2xl font-bold text-foreground">
            {formatCurrency(costForecast.projected)}
          </div>
          <div className={`flex items-center gap-1 text-sm font-medium ${
            costForecast.overBudget ? 'text-red-400' : 'text-primary'
          }`}>
            {costForecast.overBudget ? (
              <>
                <TrendingUpIcon ref={forecastIconRef} size={16} />
                Over budget by {formatCurrency(Math.abs(costForecast.delta))}
              </>
            ) : costForecast.delta !== 0 ? (
              <>
                <TrendingDownIcon ref={forecastIconRef} size={16} />
                On track ({formatCurrency(Math.abs(costForecast.delta))} under budget)
              </>
            ) : (
              <>
                <CircleCheckIcon ref={forecastIconRef} size={16} />
                On track
              </>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Based on linear regression of daily costs this month
        </p>
      </CardContent>
    </Card>
  )
}
