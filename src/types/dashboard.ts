export interface LatestRequest {
  id: string
  provider: string
  model: string
  totalTokens: number
  costUsd: number
  status: string
  latencyMs: number
  createdAt: string
}

export interface BudgetData {
  monthlyBudgetUsd: number | null
  used: number
  percent: number
  exceeded: boolean
  alerting: boolean
}

export interface CostForecast {
  projected: number
  confidence: number
  overBudget: boolean
  delta: number
}

export interface DashboardData {
  monthSpend: number
  costForecast: CostForecast | null
  todayRequests: number
  totalRequests: number
  successRate: number
  avgLatency: number
  dailyChart: { date: string; requests: number; cost: number; avgLatency: number }[]
  providerBreakdown: { provider: string; cost: number; requests: number }[]
  latestRequests: LatestRequest[]
}
