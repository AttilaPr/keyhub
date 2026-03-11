'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

interface Toast {
  id: string
  title: string
  description?: string
  variant?: 'default' | 'success' | 'destructive'
}

interface ToastContextType {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const timersRef = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const removeToast = React.useCallback((id: string) => {
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = React.useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { ...toast, id }])
    const timer = setTimeout(() => {
      timersRef.current.delete(id)
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
    timersRef.current.set(id, timer)
  }, [])

  React.useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer))
      timersRef.current.clear()
    }
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'flex items-start gap-3 rounded-lg border p-4 shadow-lg animate-in slide-in-from-right-full min-w-[320px] max-w-[420px]',
              toast.variant === 'destructive'
                ? 'border-destructive/50 bg-destructive/10 text-destructive'
                : toast.variant === 'success'
                ? 'border-lime-400/30 bg-lime-400/10 text-lime-700 dark:text-lime-300'
                : 'border-border bg-background text-foreground'
            )}
          >
            <div className="flex-1">
              <div className="text-sm font-semibold">{toast.title}</div>
              {toast.description && (
                <div className="mt-1 text-sm opacity-80">{toast.description}</div>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within a ToastProvider')
  return context
}
