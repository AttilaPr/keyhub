'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { useToast } from '@/components/ui/toast'
import { Skeleton } from '@/components/ui/skeleton'
import { Weight } from 'lucide-react'
import { PlusIcon } from '@/components/ui/plus'
import { DeleteIcon } from '@/components/ui/delete'
import { KeyIcon } from '@/components/ui/key'
import { LoaderPinwheelIcon } from '@/components/ui/loader-pinwheel'
import { ZapIcon } from '@/components/ui/zap'
import { ActivityIcon } from '@/components/ui/activity'
import { DollarSignIcon } from '@/components/ui/dollar-sign'
import { RotateCWIcon } from '@/components/ui/rotate-cw'
import { TimerIcon } from '@/components/ui/timer'
import { useAnimatedIcon } from '@/hooks/use-animated-icon'
import { formatCurrency } from '@/lib/utils'

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google' },
  { value: 'mistral', label: 'Mistral' },
]

interface ProviderKey {
  id: string
  provider: string
  label: string
  isActive: boolean
  weight: number
  latencyEma: number | null
  rotationReminderDays: number | null
  lastRotatedAt: string | null
  createdAt: string
  totalCost: number
  lastUsedAt: string | null
  _count: { logs: number }
}

function ProviderKeyCard({
  keyData,
  testingId,
  togglingId,
  rotationSaving,
  onTest,
  onToggle,
  onDelete,
  onRotationToggle,
  onRotationDaysChange,
  onWeightChange,
  providerLabel,
}: {
  keyData: ProviderKey
  testingId: string | null
  togglingId: string | null
  rotationSaving: string | null
  onTest: (id: string) => void
  onToggle: (id: string, isActive: boolean) => void
  onDelete: (id: string) => void
  onRotationToggle: (id: string, enabled: boolean, currentDays: number | null) => void
  onRotationDaysChange: (id: string, days: string) => void
  onWeightChange: (id: string, weight: string) => void
  providerLabel: (p: string) => string
}) {
  const { iconRef: activityRef, handlers: activityHandlers } = useAnimatedIcon()
  const { iconRef: dollarRef, handlers: dollarHandlers } = useAnimatedIcon()
  const { iconRef: timerRef, handlers: timerHandlers } = useAnimatedIcon()
  const { iconRef: rotateRef, handlers: rotateHandlers } = useAnimatedIcon()

  const cardHandlers = {
    onMouseEnter: (e: React.MouseEvent<HTMLDivElement>) => {
      activityHandlers.onMouseEnter()
      dollarHandlers.onMouseEnter()
      timerHandlers.onMouseEnter()
      rotateHandlers.onMouseEnter()
    },
    onMouseLeave: (e: React.MouseEvent<HTMLDivElement>) => {
      activityHandlers.onMouseLeave()
      dollarHandlers.onMouseLeave()
      timerHandlers.onMouseLeave()
      rotateHandlers.onMouseLeave()
    },
  }

  return (
    <Card {...cardHandlers}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base text-foreground">{keyData.label}</CardTitle>
          <CardDescription className="mt-1">
            {providerLabel(keyData.provider)}
          </CardDescription>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant={keyData.isActive ? 'default' : 'secondary'}
            className={keyData.isActive ? 'bg-primary/10 text-primary' : undefined}
          >
            {keyData.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <ActivityIcon ref={activityRef} size={14} />
            {keyData._count.logs.toLocaleString()} requests
          </span>
          <span className="flex items-center gap-1">
            <DollarSignIcon ref={dollarRef} size={14} />
            {formatCurrency(keyData.totalCost)}
          </span>
          <span>
            {keyData.lastUsedAt
              ? `Last used ${new Date(keyData.lastUsedAt).toLocaleDateString()}`
              : 'Never used'}
          </span>
        </div>
        {/* Weight & Latency */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Weight className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Weight</span>
            <Input
              type="number"
              min="1"
              max="10"
              defaultValue={keyData.weight}
              onBlur={(e) => onWeightChange(keyData.id, e.target.value)}
              className="h-6 w-14 text-xs px-2 py-0"
            />
          </div>
          {keyData.latencyEma != null && (
            <Badge variant="outline" className="border-border text-muted-foreground text-xs">
              <TimerIcon ref={timerRef} size={14} />
              {Math.round(keyData.latencyEma)}ms avg
            </Badge>
          )}
        </div>

        {/* Rotation Reminder */}
        <div className="rounded-md border border-border p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <RotateCWIcon ref={rotateRef} size={14} />
              Rotation reminder
            </div>
            {rotationSaving === keyData.id ? (
              <LoaderPinwheelIcon size={14} className="text-muted-foreground animate-spin" />
            ) : (
              <Switch
                checked={keyData.rotationReminderDays !== null}
                onCheckedChange={(checked) => onRotationToggle(keyData.id, checked, keyData.rotationReminderDays)}
                className="scale-75"
                aria-label={`Toggle rotation reminder for ${keyData.label}`}
              />
            )}
          </div>
          {keyData.rotationReminderDays !== null && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Every</span>
                <Input
                  type="number"
                  min="1"
                  max="365"
                  defaultValue={keyData.rotationReminderDays}
                  onBlur={(e) => onRotationDaysChange(keyData.id, e.target.value)}
                  className="h-6 w-16 text-xs px-2 py-0"
                />
                <span className="text-xs text-muted-foreground">days</span>
              </div>
              {keyData.lastRotatedAt && (() => {
                const lastRotated = new Date(keyData.lastRotatedAt)
                const daysSince = Math.floor((Date.now() - lastRotated.getTime()) / (1000 * 60 * 60 * 24))
                const interval = keyData.rotationReminderDays!
                const percentUsed = interval > 0 ? (daysSince / interval) * 100 : 0
                const isOverdue = percentUsed >= 100
                const isWarning = percentUsed >= 80

                return (
                  <Badge
                    variant="outline"
                    className={
                      isOverdue
                        ? 'border-red-400/30 text-red-400 text-xs'
                        : isWarning
                          ? 'border-yellow-400/30 text-yellow-400 text-xs'
                          : 'border-border text-muted-foreground text-xs'
                    }
                  >
                    Last rotated {daysSince}d ago
                    {isOverdue && ' — overdue'}
                  </Badge>
                )
              })()}
              {!keyData.lastRotatedAt && (
                <Badge variant="outline" className="border-border text-muted-foreground text-xs">
                  Never rotated
                </Badge>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Added {new Date(keyData.createdAt).toLocaleDateString()}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onTest(keyData.id)}
            disabled={testingId === keyData.id}
            className="text-muted-foreground hover:text-primary"
            aria-label={`Test ${keyData.label} connection`}
          >
            {testingId === keyData.id ? (
              <LoaderPinwheelIcon size={16} className="animate-spin" />
            ) : (
              <ZapIcon size={16} />
            )}
          </Button>
          {togglingId === keyData.id ? (
            <LoaderPinwheelIcon size={16} className="animate-spin text-muted-foreground" />
          ) : (
            <Switch
              checked={keyData.isActive}
              onCheckedChange={(checked) => onToggle(keyData.id, checked)}
              aria-label={`Toggle ${keyData.label} ${keyData.isActive ? 'off' : 'on'}`}
            />
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(keyData.id)}
            className="text-muted-foreground hover:text-red-400"
            aria-label={`Delete ${keyData.label}`}
          >
            <DeleteIcon size={16} />
          </Button>
        </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function ProviderKeysPage() {
  const [keys, setKeys] = useState<ProviderKey[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [provider, setProvider] = useState('')
  const [label, setLabel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [rotationSaving, setRotationSaving] = useState<string | null>(null)
  const { addToast } = useToast()

  const { iconRef: emptyKeyRef, handlers: emptyKeyHandlers } = useAnimatedIcon()

  async function fetchKeys(signal?: AbortSignal) {
    try {
      const res = await fetch('/api/keys/provider', { signal })
      const data = await res.json()
      // Support both paginated { keys, total } and legacy array responses
      setKeys(Array.isArray(data) ? data : data.keys ?? [])
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    fetchKeys(controller.signal)
    return () => controller.abort()
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const res = await fetch('/api/keys/provider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, label, apiKey }),
    })

    if (res.ok) {
      addToast({ title: 'Key saved', description: `${label} has been encrypted and stored.`, variant: 'success' })
      setDialogOpen(false)
      setProvider('')
      setLabel('')
      setApiKey('')
      fetchKeys()
    } else {
      const data = await res.json()
      addToast({ title: 'Error', description: data.error, variant: 'destructive' })
    }
    setSaving(false)
  }

  async function handleToggle(id: string, isActive: boolean) {
    setTogglingId(id)
    try {
      const res = await fetch('/api/keys/provider', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        addToast({ title: 'Failed to update key', description: data.error || 'Something went wrong', variant: 'destructive' })
      }
      fetchKeys()
    } catch {
      addToast({ title: 'Network error', description: 'Could not reach server', variant: 'destructive' })
    } finally {
      setTogglingId(null)
    }
  }

  async function handleTest(id: string) {
    setTestingId(id)
    try {
      const res = await fetch('/api/keys/provider/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (data.success) {
        addToast({
          title: 'Connection successful',
          description: `Provider responded in ${data.latencyMs}ms`,
          variant: 'success',
        })
      } else {
        addToast({
          title: 'Connection failed',
          description: data.error || 'Could not reach provider',
          variant: 'destructive',
        })
      }
    } catch {
      addToast({
        title: 'Connection failed',
        description: 'Network error while testing key',
        variant: 'destructive',
      })
    }
    setTestingId(null)
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/keys/provider?id=${deleteId}`, { method: 'DELETE' })
      if (res.ok) {
        addToast({ title: 'Key deleted', variant: 'default' })
        setDeleteId(null)
        fetchKeys()
      } else {
        const data = await res.json().catch(() => ({}))
        addToast({ title: 'Failed to delete key', description: data.error || 'Something went wrong', variant: 'destructive' })
      }
    } catch {
      addToast({ title: 'Network error', description: 'Could not reach server', variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  async function handleRotationToggle(id: string, enabled: boolean, currentDays: number | null) {
    setRotationSaving(id)
    try {
      const res = await fetch('/api/keys/provider', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          rotationReminderDays: enabled ? (currentDays || 90) : null,
        }),
      })
      if (res.ok) {
        addToast({ title: enabled ? 'Rotation reminder enabled' : 'Rotation reminder disabled', variant: 'success' })
        fetchKeys()
      } else {
        const data = await res.json().catch(() => ({}))
        addToast({ title: 'Failed to update', description: data.error || 'Something went wrong', variant: 'destructive' })
      }
    } catch {
      addToast({ title: 'Network error', description: 'Could not reach server', variant: 'destructive' })
    } finally {
      setRotationSaving(null)
    }
  }

  async function handleRotationDaysChange(id: string, days: string) {
    const parsed = parseInt(days, 10)
    if (isNaN(parsed) || parsed < 1) return
    setRotationSaving(id)
    try {
      const res = await fetch('/api/keys/provider', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, rotationReminderDays: parsed }),
      })
      if (res.ok) {
        fetchKeys()
      }
    } catch {
      // silently fail on blur save
    } finally {
      setRotationSaving(null)
    }
  }

  async function handleWeightChange(id: string, weightVal: string) {
    const parsed = parseInt(weightVal, 10)
    if (isNaN(parsed) || parsed < 1 || parsed > 10) return
    try {
      const res = await fetch('/api/keys/provider', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, weight: parsed }),
      })
      if (res.ok) {
        fetchKeys()
      }
    } catch {
      // silently fail on blur save
    }
  }

  const providerLabel = (p: string) =>
    PROVIDERS.find((x) => x.value === p)?.label || p

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Provider Keys</h1>
          <p className="text-muted-foreground">Manage your real AI provider API keys</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <PlusIcon size={16} className="mr-2" />
          Add Key
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : keys.length === 0 ? (
        <Card {...emptyKeyHandlers}>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <KeyIcon ref={emptyKeyRef} size={48} className="text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">No provider keys yet. Add your first API key to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {keys.map((key) => (
            <ProviderKeyCard
              key={key.id}
              keyData={key}
              testingId={testingId}
              togglingId={togglingId}
              rotationSaving={rotationSaving}
              onTest={handleTest}
              onToggle={handleToggle}
              onDelete={(id) => setDeleteId(id)}
              onRotationToggle={handleRotationToggle}
              onRotationDaysChange={handleRotationDaysChange}
              onWeightChange={handleWeightChange}
              providerLabel={providerLabel}
            />
          ))}
        </div>
      )}

      {/* Add Key Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Provider Key</DialogTitle>
            <DialogDescription>
              Your API key will be encrypted with AES-256-GCM before storage.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={provider} onValueChange={(v) => v && setProvider(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="key-label">Label</Label>
              <Input
                id="key-label"
                placeholder="e.g. My OpenAI Key"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-key">API Key</Label>
              <Input
                id="api-key"
                type="password"
                placeholder="sk-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                required
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !provider}>
                {saving && <LoaderPinwheelIcon size={16} className="mr-2 animate-spin" />}
                Save Key
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) { setDeleteId(null); setDeleting(false) } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete provider key?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Any proxy requests using this provider will fail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700" disabled={deleting}>
              {deleting && <LoaderPinwheelIcon size={16} className="mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
