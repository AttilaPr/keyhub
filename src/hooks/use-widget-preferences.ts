'use client'

import { useState, useEffect } from 'react'
import { DEFAULT_VISIBLE_WIDGETS } from '@/lib/widget-registry'

const STORAGE_KEY = 'keyhub-dashboard-widgets'

export function useWidgetPreferences() {
  const [visibleWidgets, setVisibleWidgets] = useState<string[]>(DEFAULT_VISIBLE_WIDGETS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) setVisibleWidgets(parsed)
      }
    } catch {
      // ignore parse errors
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (loaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleWidgets))
    }
  }, [visibleWidgets, loaded])

  const toggleWidget = (widgetId: string) => {
    setVisibleWidgets(prev =>
      prev.includes(widgetId) ? prev.filter(id => id !== widgetId) : [...prev, widgetId]
    )
  }

  const resetToDefaults = () => setVisibleWidgets(DEFAULT_VISIBLE_WIDGETS)
  const isVisible = (widgetId: string) => visibleWidgets.includes(widgetId)

  return { visibleWidgets, toggleWidget, resetToDefaults, isVisible }
}
