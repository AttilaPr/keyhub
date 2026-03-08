'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { SettingsIcon } from '@/components/ui/settings'
import { WIDGET_REGISTRY } from '@/lib/widget-registry'

interface WidgetPickerProps {
  visibleWidgets: string[]
  onToggle: (id: string) => void
  onReset: () => void
}

export function WidgetPickerDialog({ visibleWidgets, onToggle, onReset }: WidgetPickerProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <SettingsIcon size={16} />
          Customize
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Customize Dashboard</DialogTitle>
          <DialogDescription>Choose which widgets to display on your dashboard.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {WIDGET_REGISTRY.map((widget) => {
            const isChecked = visibleWidgets.includes(widget.id)
            const isDisabled = !widget.removable

            return (
              <label
                key={widget.id}
                className={`flex items-start gap-3 rounded-lg border border-border/50 p-3 transition-colors ${
                  isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-muted/50'
                }`}
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() => {
                    if (!isDisabled) onToggle(widget.id)
                  }}
                  disabled={isDisabled}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">{widget.label}</div>
                  <div className="text-xs text-muted-foreground">{widget.description}</div>
                </div>
              </label>
            )
          })}
        </div>
        <div className="flex justify-end pt-2">
          <Button variant="ghost" size="sm" onClick={onReset}>
            Reset to Defaults
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
