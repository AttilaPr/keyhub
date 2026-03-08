'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Wallet } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { BudgetData } from '@/types/dashboard'

interface BudgetProgressProps {
  budget: BudgetData | null
}

export function BudgetProgress({ budget }: BudgetProgressProps) {
  if (!budget || budget.monthlyBudgetUsd === null) return null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Wallet className="h-4 w-4" />
          Monthly Budget
        </CardTitle>
        <span className="text-xs text-muted-foreground">
          {formatCurrency(budget.used)} / {formatCurrency(budget.monthlyBudgetUsd)}
        </span>
      </CardHeader>
      <CardContent>
        <div className="w-full h-3 bg-card rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              budget.percent >= 0.95
                ? 'bg-red-500'
                : budget.percent >= 0.75
                  ? 'bg-yellow-500'
                  : 'bg-primary'
            }`}
            style={{ width: `${Math.min(budget.percent * 100, 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className={`text-xs ${
            budget.percent >= 0.95 ? 'text-red-400' : budget.percent >= 0.75 ? 'text-yellow-400' : 'text-muted-foreground'
          }`}>
            {(budget.percent * 100).toFixed(1)}% used
          </span>
          {budget.exceeded && (
            <span className="text-xs text-red-400 font-medium">Budget exceeded — requests blocked</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
