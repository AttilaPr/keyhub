"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { MoonIcon } from "@/components/ui/moon"
import { SunIcon } from "@/components/ui/sun"
import { MonitorCheckIcon } from "@/components/ui/monitor-check"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type Theme = "dark" | "light" | "system"

const COOKIE_NAME = "keyhub-theme"

function getSystemTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark"
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

function getCookieTheme(): Theme {
  if (typeof document === "undefined") return "dark"
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${COOKIE_NAME}=`))
  const value = match?.split("=")[1]
  if (value === "light" || value === "system") return value
  return "dark"
}

function setCookieTheme(theme: Theme) {
  document.cookie = `${COOKIE_NAME}=${theme};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`
}

function applyTheme(theme: Theme) {
  const resolved = theme === "system" ? getSystemTheme() : theme
  const html = document.documentElement
  html.classList.remove("dark", "light")
  html.classList.add(resolved)
}

const themeOrder: Theme[] = ["dark", "light", "system"]
const themeLabels: Record<Theme, string> = {
  dark: "Dark",
  light: "Light",
  system: "System",
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark")

  useEffect(() => {
    const saved = getCookieTheme()
    setTheme(saved)
    applyTheme(saved)
  }, [])

  // Listen for system theme changes when in "system" mode
  useEffect(() => {
    if (theme !== "system") return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = () => applyTheme("system")
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [theme])

  function cycleTheme() {
    const currentIndex = themeOrder.indexOf(theme)
    const nextTheme = themeOrder[(currentIndex + 1) % themeOrder.length]
    setTheme(nextTheme)
    setCookieTheme(nextTheme)
    applyTheme(nextTheme)
  }

  const Icon =
    theme === "dark" ? MoonIcon : theme === "light" ? SunIcon : MonitorCheckIcon

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={cycleTheme}
            aria-label={`Theme: ${themeLabels[theme]}. Click to cycle.`}
          />
        }
      >
        <Icon size={16} />
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {themeLabels[theme]} theme
      </TooltipContent>
    </Tooltip>
  )
}
