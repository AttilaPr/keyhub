'use client'

import { XIcon } from '@/components/ui/x'

interface WidgetWrapperProps {
  widgetId: string
  removable: boolean
  onRemove: (id: string) => void
  children: React.ReactNode
}

export function WidgetWrapper({ widgetId, removable, onRemove, children }: WidgetWrapperProps) {
  return (
    <div className="group/widget relative">
      {children}
      {removable && (
        <button
          onClick={() => onRemove(widgetId)}
          className="absolute top-2 right-2 z-10 opacity-0 group-hover/widget:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm rounded-md p-1 text-muted-foreground hover:text-foreground border border-border/50"
          aria-label="Remove widget"
        >
          <XIcon size={14} />
        </button>
      )}
    </div>
  )
}
