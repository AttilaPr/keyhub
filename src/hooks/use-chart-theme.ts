"use client"

import { useEffect, useState } from "react"

interface ChartTheme {
  grid: string
  tick: string
  tooltipBg: string
  tooltipBorder: string
  tooltipText: string
}

const darkTheme: ChartTheme = {
  grid: "#1a2e1a",
  tick: "#71717a",
  tooltipBg: "#0f1a0f",
  tooltipBorder: "#1a2e1a",
  tooltipText: "#fff",
}

const lightTheme: ChartTheme = {
  grid: "#e2e8f0",
  tick: "#64748b",
  tooltipBg: "#ffffff",
  tooltipBorder: "#e2e8f0",
  tooltipText: "#0f172a",
}

export function useChartTheme(): ChartTheme {
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    const html = document.documentElement
    setIsDark(html.classList.contains("dark"))

    const observer = new MutationObserver(() => {
      setIsDark(html.classList.contains("dark"))
    })
    observer.observe(html, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])

  return isDark ? darkTheme : lightTheme
}
