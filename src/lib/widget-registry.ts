export interface WidgetDefinition {
  id: string
  label: string
  description: string
  colSpan: 'full' | 'half' | 'third'
  removable: boolean
  defaultVisible: boolean
}

export const WIDGET_REGISTRY: WidgetDefinition[] = [
  { id: 'kpi-cards', label: 'KPI Cards', description: 'Monthly spend, requests, success rate, latency', colSpan: 'full', removable: false, defaultVisible: true },
  { id: 'budget-progress', label: 'Budget Progress', description: 'Monthly budget usage bar', colSpan: 'full', removable: true, defaultVisible: true },
  { id: 'cost-forecast', label: 'Cost Forecast', description: 'Projected month-end spend', colSpan: 'full', removable: true, defaultVisible: true },
  { id: 'requests-chart', label: 'Requests per Day', description: 'Bar chart of daily request volume', colSpan: 'third', removable: true, defaultVisible: true },
  { id: 'daily-cost-chart', label: 'Daily Cost', description: 'Line chart of daily cost', colSpan: 'third', removable: true, defaultVisible: true },
  { id: 'latency-chart', label: 'Avg Latency / Day', description: 'Line chart of daily average latency', colSpan: 'third', removable: true, defaultVisible: true },
  { id: 'provider-breakdown', label: 'Cost by Provider', description: 'Provider cost breakdown chart', colSpan: 'half', removable: true, defaultVisible: true },
  { id: 'recent-activity', label: 'Recent Activity', description: 'Latest API requests table', colSpan: 'half', removable: true, defaultVisible: true },
]

export const DEFAULT_VISIBLE_WIDGETS = WIDGET_REGISTRY.filter(w => w.defaultVisible).map(w => w.id)
