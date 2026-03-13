"use client"

import { useEffect, useRef } from "react"

/**
 * Adds `animate-fade-in-up` to the element when it enters the viewport.
 * Returns a ref to attach to the element.
 */
export function useScrollAnimation(delay?: string) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Start invisible
    el.style.opacity = "0"

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("animate-fade-in-up")
          if (delay) el.classList.add(delay)
          el.style.opacity = ""
          observer.unobserve(el)
        }
      },
      { threshold: 0.15 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [delay])

  return ref
}
