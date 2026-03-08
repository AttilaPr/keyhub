import { useRef } from "react"

interface AnimatedIconHandle {
  startAnimation: () => void
  stopAnimation: () => void
}

/**
 * Hook for triggering animated icon animation on parent hover.
 * Usage:
 * ```
 * const { iconRef, handlers } = useAnimatedIcon()
 * <Card {...handlers}>
 *   <SomeIcon ref={iconRef} size={16} />
 * </Card>
 * ```
 */
export function useAnimatedIcon() {
  const iconRef = useRef<AnimatedIconHandle | null>(null)
  const handlers = {
    onMouseEnter: () => iconRef.current?.startAnimation?.(),
    onMouseLeave: () => iconRef.current?.stopAnimation?.(),
  }
  return { iconRef, handlers }
}

export type { AnimatedIconHandle }
