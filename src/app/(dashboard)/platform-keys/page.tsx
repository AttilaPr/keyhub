'use client'

import { useEffect, useState, useMemo } from 'react'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { useToast } from '@/components/ui/toast'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiFetch } from '@/lib/fetch'
import { Crosshair } from 'lucide-react'
import { PlusIcon } from '@/components/ui/plus'
import { CopyIcon } from '@/components/ui/copy'
import { ShieldCheckIcon } from '@/components/ui/shield-check'
import { LoaderPinwheelIcon } from '@/components/ui/loader-pinwheel'
import { DeleteIcon } from '@/components/ui/delete'
import { CheckIcon } from '@/components/ui/check'
import { GaugeIcon } from '@/components/ui/gauge'
import { ClockIcon } from '@/components/ui/clock'
import { SquarePenIcon } from '@/components/ui/square-pen'
import { BadgeAlertIcon } from '@/components/ui/badge-alert'
import { DollarSignIcon } from '@/components/ui/dollar-sign'
import { LockIcon } from '@/components/ui/lock'
import { EarthIcon } from '@/components/ui/earth'
import { XIcon } from '@/components/ui/x'
import { RefreshCWIcon } from '@/components/ui/refresh-cw'
import { RotateCWIcon } from '@/components/ui/rotate-cw'
import { useAnimatedIcon } from '@/hooks/use-animated-icon'
import { isValidIpOrCidr } from '@/lib/ip-utils'

const FALLBACK_STATUS_OPTIONS = [
  { value: 429, label: '429 - Rate Limited' },
  { value: 500, label: '500 - Internal Error' },
  { value: 502, label: '502 - Bad Gateway' },
  { value: 503, label: '503 - Unavailable' },
  { value: 504, label: '504 - Gateway Timeout' },
] as const

const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google' },
  { value: 'mistral', label: 'Mistral' },
] as const

// Populated from /api/models on mount
const FALLBACK_PROVIDER_MODELS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini'],
  anthropic: ['claude-3-5-sonnet-20241022'],
  google: ['gemini-2.0-flash'],
  mistral: ['mistral-large-latest'],
}

interface FallbackRule {
  id?: string
  primaryProvider: string
  fallbackProvider: string
  triggerOnStatus: number[]
  priority: number
}

interface PlatformKey {
  id: string
  label: string
  keyPrefix: string
  isActive: boolean
  rateLimit: number | null
  expiresAt: string | null
  budgetUsd: number | null
  budgetPeriod: string | null
  budgetUsed: number | null
  allowedProviders: string[]
  allowedModels: string[]
  maxCostPerRequest: number | null
  ipAllowlist: string[]
  maxRetries: number | null
  routingStrategy: string
  fallbackRules: FallbackRule[]
  lastUsedAt: string | null
  createdAt: string
  _count: { logs: number }
}

export default function PlatformKeysPage() {
  const [keys, setKeys] = useState<PlatformKey[]>([])
  const [providerModels, setProviderModels] = useState<Record<string, string[]>>(FALLBACK_PROVIDER_MODELS)
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [showKeyOpen, setShowKeyOpen] = useState(false)
  const [newKeyLabel, setNewKeyLabel] = useState('')
  const [newKeyRateLimit, setNewKeyRateLimit] = useState('')
  const [newKeyExpiresAt, setNewKeyExpiresAt] = useState('')
  const [newRawKey, setNewRawKey] = useState('')
  const [saving, setSaving] = useState(false)
  const { copy, copied } = useCopyToClipboard()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [editKey, setEditKey] = useState<PlatformKey | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editRateLimit, setEditRateLimit] = useState('')
  const [editExpiresAt, setEditExpiresAt] = useState('')
  const [editAllowedProviders, setEditAllowedProviders] = useState<string[]>([])
  const [editAllowedModels, setEditAllowedModels] = useState<string[]>([])
  const [editMaxCostPerRequest, setEditMaxCostPerRequest] = useState('')
  const [editIpAllowlist, setEditIpAllowlist] = useState<string[]>([])
  const [editIpInput, setEditIpInput] = useState('')
  const [editIpError, setEditIpError] = useState('')
  const [editMaxRetries, setEditMaxRetries] = useState('')
  const [editRoutingStrategy, setEditRoutingStrategy] = useState('round-robin')
  const [editFallbackRules, setEditFallbackRules] = useState<FallbackRule[]>([])
  const [editSaving, setEditSaving] = useState(false)
  const [detectingIp, setDetectingIp] = useState(false)
  const { addToast } = useToast()

  // Animated icon refs for section hover
  const { iconRef: emptyShieldRef, handlers: emptyShieldHandlers } = useAnimatedIcon()
  const { iconRef: restrictionsLockRef, handlers: restrictionsLockHandlers } = useAnimatedIcon()
  const { iconRef: ipEarthRef, handlers: ipEarthHandlers } = useAnimatedIcon()
  const { iconRef: fallbackRefreshRef, handlers: fallbackRefreshHandlers } = useAnimatedIcon()

  // Compute available models based on selected providers
  const availableModels = useMemo(() => {
    const providers = editAllowedProviders.length > 0
      ? editAllowedProviders
      : Object.keys(providerModels)
    return providers.flatMap((p) => (providerModels[p] || []).map((m) => ({ provider: p, model: `${p}/${m}` })))
  }, [editAllowedProviders, providerModels])

  async function fetchKeys(signal?: AbortSignal) {
    try {
      const res = await fetch('/api/keys/platform', { signal })
      const data = await res.json()
      setKeys(data)
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    fetchKeys(controller.signal)
    fetch('/api/models')
      .then((res) => res.ok ? res.json() : null)
      .then((data: { providers: { key: string; models: string[] }[] } | null) => {
        if (data?.providers) {
          const map: Record<string, string[]> = {}
          for (const p of data.providers) {
            map[p.key] = p.models.map((m) => m.replace(`${p.key}/`, ''))
          }
          setProviderModels(map)
        }
      })
      .catch(() => {})
    return () => controller.abort()
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const res = await apiFetch('/api/keys/platform', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: newKeyLabel,
        rateLimit: newKeyRateLimit || null,
        expiresAt: newKeyExpiresAt || null,
      }),
    })

    if (res.ok) {
      const data = await res.json()
      setNewRawKey(data.rawKey)
      setCreateOpen(false)
      setShowKeyOpen(true)
      setNewKeyLabel('')
      setNewKeyRateLimit('')
      setNewKeyExpiresAt('')
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
      const res = await apiFetch('/api/keys/platform', {
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

  function openEdit(key: PlatformKey) {
    setEditKey(key)
    setEditLabel(key.label)
    setEditRateLimit(key.rateLimit ? String(key.rateLimit) : '')
    setEditExpiresAt(key.expiresAt ? key.expiresAt.split('T')[0] : '')
    setEditAllowedProviders(key.allowedProviders || [])
    setEditAllowedModels(key.allowedModels || [])
    setEditMaxCostPerRequest(key.maxCostPerRequest ? String(key.maxCostPerRequest) : '')
    setEditIpAllowlist(key.ipAllowlist || [])
    setEditIpInput('')
    setEditIpError('')
    setEditMaxRetries(key.maxRetries != null ? String(key.maxRetries) : '')
    setEditRoutingStrategy(key.routingStrategy || 'round-robin')
    setEditFallbackRules(key.fallbackRules || [])
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editKey) return
    setEditSaving(true)

    // Clean up allowed models: remove any models whose provider is no longer selected
    const finalAllowedModels = editAllowedProviders.length > 0
      ? editAllowedModels.filter((m) => editAllowedProviders.some((p) => m.startsWith(`${p}/`)))
      : editAllowedModels

    const res = await apiFetch('/api/keys/platform', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editKey.id,
        label: editLabel,
        rateLimit: editRateLimit || null,
        expiresAt: editExpiresAt || null,
        allowedProviders: editAllowedProviders,
        allowedModels: finalAllowedModels,
        maxCostPerRequest: editMaxCostPerRequest || null,
        ipAllowlist: editIpAllowlist,
        maxRetries: editMaxRetries ? parseInt(editMaxRetries, 10) : null,
        routingStrategy: editRoutingStrategy,
        fallbackRules: editFallbackRules.filter(
          (r) => r.primaryProvider && r.fallbackProvider && r.triggerOnStatus.length > 0
        ),
      }),
    })

    if (res.ok) {
      addToast({ title: 'Key updated', description: 'Platform key settings saved.', variant: 'success' })
      setEditKey(null)
      fetchKeys()
    } else {
      const data = await res.json()
      addToast({ title: 'Error', description: data.error, variant: 'destructive' })
    }
    setEditSaving(false)
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await apiFetch(`/api/keys/platform?id=${deleteId}`, { method: 'DELETE' })
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

  async function copyKey() {
    const ok = await copy(newRawKey)
    if (!ok) {
      addToast({ title: 'Failed to copy', description: 'Could not access clipboard', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Platform Keys</h1>
          <p className="text-muted-foreground">Virtual API keys for your applications</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <PlusIcon size={16} className="mr-2" />
          Create Key
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          </CardContent>
        </Card>
      ) : keys.length === 0 ? (
        <Card {...emptyShieldHandlers}>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShieldCheckIcon ref={emptyShieldRef} size={48} className="text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">No platform keys yet. Create one to start using the API.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rate Limit</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Restrictions</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Requests</TableHead>
                <TableHead>Last Used</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium text-foreground">{key.label}</TableCell>
                  <TableCell>
                    <code className="rounded bg-card px-2 py-1 text-xs text-muted-foreground">
                      {key.keyPrefix}...
                    </code>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={key.isActive ? 'default' : 'secondary'}
                      className={key.isActive ? 'bg-primary/10 text-primary' : undefined}
                    >
                      {key.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {key.rateLimit ? (
                      <span className="flex items-center gap-1">
                        <GaugeIcon size={14} />
                        {key.rateLimit}/min
                      </span>
                    ) : (
                      'Unlimited'
                    )}
                  </TableCell>
                  <TableCell>
                    {key.budgetUsd != null && key.budgetUsed != null ? (() => {
                      const percent = key.budgetUsd > 0 ? (key.budgetUsed / key.budgetUsd) * 100 : 0
                      const exceeded = percent >= 100
                      const barColor = exceeded || percent > 95
                        ? 'bg-red-500'
                        : percent > 75
                          ? 'bg-yellow-500'
                          : 'bg-primary'
                      return (
                        <div className="space-y-1 min-w-[120px]">
                          {exceeded && (
                            <div className="flex items-center gap-1 text-xs text-red-400 font-medium">
                              <BadgeAlertIcon size={14} />
                              Budget exceeded
                            </div>
                          )}
                          <div className="flex items-center gap-1.5">
                            <div className="h-1.5 flex-1 rounded-full bg-card overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${barColor}`}
                                style={{ width: `${Math.min(percent, 100)}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            ${key.budgetUsed.toFixed(2)} / ${key.budgetUsd.toFixed(2)}
                          </span>
                        </div>
                      )
                    })() : (
                      <span className="text-muted-foreground text-xs">No budget</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {key.allowedProviders.length > 0 && (
                        <Badge variant="outline" className="text-xs border-lime-400/30 text-primary">
                          <LockIcon size={14} className="mr-1" />
                          {key.allowedProviders.length === 1
                            ? `${PROVIDER_OPTIONS.find(p => p.value === key.allowedProviders[0])?.label || key.allowedProviders[0]} only`
                            : `${key.allowedProviders.length} providers`}
                        </Badge>
                      )}
                      {key.allowedModels.length > 0 && (
                        <Badge variant="outline" className="text-xs border-lime-400/30 text-primary">
                          {key.allowedModels.length === 1
                            ? key.allowedModels[0].split('/').pop()
                            : `${key.allowedModels.length} models`}
                        </Badge>
                      )}
                      {key.maxCostPerRequest != null && (
                        <Badge variant="outline" className="text-xs border-lime-400/30 text-primary">
                          <DollarSignIcon size={14} className="mr-0.5" />
                          Max ${key.maxCostPerRequest.toFixed(2)}/req
                        </Badge>
                      )}
                      {key.allowedProviders.length === 0 && key.allowedModels.length === 0 && key.maxCostPerRequest == null && (
                        <span className="text-muted-foreground text-xs">None</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {key.expiresAt ? (() => {
                      const now = new Date()
                      const expires = new Date(key.expiresAt)
                      const daysLeft = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                      if (daysLeft <= 0) {
                        return (
                          <span className="flex items-center gap-1 text-red-400">
                            <ClockIcon size={14} />
                            Expired
                          </span>
                        )
                      }
                      if (daysLeft <= 7) {
                        return (
                          <span className="flex items-center gap-1 text-yellow-400">
                            <BadgeAlertIcon size={14} />
                            {daysLeft}d left
                          </span>
                        )
                      }
                      return (
                        <span className="flex items-center gap-1">
                          <ClockIcon size={14} />
                          {expires.toLocaleDateString()}
                        </span>
                      )
                    })() : (
                      'Never'
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{key._count.logs}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {key.lastUsedAt
                      ? new Date(key.lastUsedAt).toLocaleDateString()
                      : 'Never'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(key.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(key)}
                        className="text-muted-foreground hover:text-primary"
                        aria-label={`Edit ${key.label} settings`}
                      >
                        <SquarePenIcon size={16} />
                      </Button>
                      {togglingId === key.id ? (
                        <LoaderPinwheelIcon size={16} className="animate-spin text-muted-foreground" />
                      ) : (
                        <Switch
                          checked={key.isActive}
                          onCheckedChange={(checked) => handleToggle(key.id, checked)}
                          aria-label={`Toggle ${key.label} ${key.isActive ? 'off' : 'on'}`}
                        />
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(key.id)}
                        className="text-muted-foreground hover:text-red-400"
                        aria-label={`Delete ${key.label}`}
                      >
                        <DeleteIcon size={16} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create Key Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Platform Key</DialogTitle>
            <DialogDescription>
              Generate a new API key for your applications.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pk-label">Label</Label>
              <Input
                id="pk-label"
                placeholder="e.g. Production App"
                value={newKeyLabel}
                onChange={(e) => setNewKeyLabel(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pk-rate-limit">Rate Limit (requests/min)</Label>
              <Input
                id="pk-rate-limit"
                type="number"
                min="1"
                placeholder="Leave empty for unlimited"
                value={newKeyRateLimit}
                onChange={(e) => setNewKeyRateLimit(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Set a maximum number of requests per minute. Leave empty for no limit.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pk-expires">Expiration Date</Label>
              <Input
                id="pk-expires"
                type="date"
                min={new Date().toISOString().split('T')[0]}
                value={newKeyExpiresAt}
                onChange={(e) => setNewKeyExpiresAt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Set an expiration date for this key. Leave empty for no expiration.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <LoaderPinwheelIcon size={16} className="mr-2 animate-spin" />}
                Generate Key
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Show Key Dialog (once only) */}
      <Dialog open={showKeyOpen} onOpenChange={setShowKeyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy Your API Key</DialogTitle>
            <DialogDescription>
              This key will only be shown once. Copy it now and store it securely.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <code className="block w-full break-all rounded-lg border border-border bg-muted p-4 text-sm text-foreground">
                {newRawKey}
              </code>
            </div>
            <div className="flex justify-end gap-3">
              <Button onClick={copyKey} variant="outline">
                {copied ? (
                  <CheckIcon size={16} className="mr-2 text-primary" />
                ) : (
                  <CopyIcon size={16} className="mr-2" />
                )}
                {copied ? 'Copied!' : 'Copy Key'}
              </Button>
              <Button onClick={() => { setShowKeyOpen(false); setNewRawKey('') }}>
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Key Dialog */}
      <Dialog open={!!editKey} onOpenChange={(open) => !open && setEditKey(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Platform Key</DialogTitle>
            <DialogDescription>
              Update settings for <span className="font-medium text-foreground">{editKey?.label}</span>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-label">Label</Label>
              <Input
                id="edit-label"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-rate-limit">Rate Limit (requests/min)</Label>
              <Input
                id="edit-rate-limit"
                type="number"
                min="1"
                placeholder="Leave empty for unlimited"
                value={editRateLimit}
                onChange={(e) => setEditRateLimit(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to remove the rate limit.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-expires">Expiration Date</Label>
              <Input
                id="edit-expires"
                type="date"
                value={editExpiresAt}
                onChange={(e) => setEditExpiresAt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to remove expiration. Can set a past date to immediately expire the key.
              </p>
            </div>

            <Separator />

            {/* Restrictions Section */}
            <div className="space-y-4">
              <div {...restrictionsLockHandlers}>
                <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                  <LockIcon ref={restrictionsLockRef} size={16} className="text-primary" />
                  Restrictions
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Limit which providers and models this key can access.
                </p>
              </div>

              {/* Allowed Providers */}
              <div className="space-y-2">
                <Label>Allowed Providers</Label>
                <div className="grid grid-cols-2 gap-2">
                  {PROVIDER_OPTIONS.map((provider) => {
                    const checked = editAllowedProviders.includes(provider.value)
                    return (
                      <label
                        key={provider.value}
                        className="flex items-center gap-2 rounded-md border border-border px-3 py-2 cursor-pointer hover:border-border transition-colors has-[:checked]:border-lime-400/40 has-[:checked]:bg-primary/5"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => {
                            setEditAllowedProviders((prev) =>
                              checked
                                ? prev.filter((p) => p !== provider.value)
                                : [...prev, provider.value]
                            )
                          }}
                        />
                        <span className="text-sm text-muted-foreground">{provider.label}</span>
                      </label>
                    )
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Leave all unchecked to allow all providers.
                </p>
              </div>

              {/* Allowed Models */}
              <div className="space-y-2">
                <Label>Allowed Models</Label>
                <div className="max-h-48 overflow-y-auto rounded-md border border-border divide-y divide-zinc-800">
                  {availableModels.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">No models available for selected providers.</p>
                  ) : (
                    availableModels.map(({ provider, model }) => {
                      const checked = editAllowedModels.includes(model)
                      const modelName = model.split('/').pop() || model
                      const providerLabel = PROVIDER_OPTIONS.find(p => p.value === provider)?.label || provider
                      return (
                        <label
                          key={model}
                          className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => {
                              setEditAllowedModels((prev) =>
                                checked
                                  ? prev.filter((m) => m !== model)
                                  : [...prev, model]
                              )
                            }}
                          />
                          <span className="text-sm text-muted-foreground">{modelName}</span>
                          <span className="text-xs text-muted-foreground ml-auto">{providerLabel}</span>
                        </label>
                      )
                    })
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Leave all unchecked to allow all models.
                </p>
              </div>

              {/* Max Cost Per Request */}
              <div className="space-y-2">
                <Label htmlFor="edit-max-cost">Max Cost Per Request</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    id="edit-max-cost"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="No limit"
                    value={editMaxCostPerRequest}
                    onChange={(e) => setEditMaxCostPerRequest(e.target.value)}
                    className="pl-7"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Reject requests if estimated input cost exceeds this amount. Leave empty for no limit.
                </p>
              </div>

              {/* Max Retries */}
              <div className="space-y-2">
                <Label htmlFor="edit-max-retries" className="flex items-center gap-2">
                  <RotateCWIcon size={14} className="text-primary" />
                  Max Retries
                </Label>
                <Input
                  id="edit-max-retries"
                  type="number"
                  min="0"
                  max="10"
                  placeholder="Default (2)"
                  value={editMaxRetries}
                  onChange={(e) => setEditMaxRetries(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Override the default retry count (2) for failed provider requests. Set to 0 to disable retries. Leave empty for default.
                </p>
              </div>

              {/* Routing Strategy */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <RefreshCWIcon size={14} className="text-primary" />
                  Load Balancing Strategy
                </Label>
                <Select value={editRoutingStrategy} onValueChange={(v) => v && setEditRoutingStrategy(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="round-robin">Round Robin (weighted)</SelectItem>
                    <SelectItem value="least-latency">Least Latency</SelectItem>
                    <SelectItem value="random">Random (weighted)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  How requests are distributed when multiple provider keys exist for the same provider. Weights are configured on each provider key.
                </p>
              </div>
            </div>

            <Separator />

            {/* IP Allowlist Section */}
            <div className="space-y-4">
              <div {...ipEarthHandlers}>
                <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                  <EarthIcon ref={ipEarthRef} size={16} className="text-primary" />
                  IP Allowlist
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Restrict API access to specific IP addresses or CIDR ranges. Leave empty to allow all IPs.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. 192.168.1.0/24 or 10.0.0.1"
                    value={editIpInput}
                    onChange={(e) => {
                      setEditIpInput(e.target.value)
                      setEditIpError('')
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const val = editIpInput.trim()
                        if (!val) return
                        if (!isValidIpOrCidr(val)) {
                          setEditIpError('Invalid IP address or CIDR range')
                          return
                        }
                        if (editIpAllowlist.includes(val)) {
                          setEditIpError('IP already in allowlist')
                          return
                        }
                        setEditIpAllowlist((prev) => [...prev, val])
                        setEditIpInput('')
                        setEditIpError('')
                      }
                    }}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => {
                      const val = editIpInput.trim()
                      if (!val) return
                      if (!isValidIpOrCidr(val)) {
                        setEditIpError('Invalid IP address or CIDR range')
                        return
                      }
                      if (editIpAllowlist.includes(val)) {
                        setEditIpError('IP already in allowlist')
                        return
                      }
                      setEditIpAllowlist((prev) => [...prev, val])
                      setEditIpInput('')
                      setEditIpError('')
                    }}
                  >
                    <PlusIcon size={16} className="mr-1" />
                    Add
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    disabled={detectingIp}
                    onClick={async () => {
                      setDetectingIp(true)
                      try {
                        const res = await fetch('/api/my-ip')
                        if (res.ok) {
                          const data = await res.json()
                          if (data.ip && !editIpAllowlist.includes(data.ip)) {
                            setEditIpAllowlist((prev) => [...prev, data.ip])
                          } else if (data.ip) {
                            setEditIpError('IP already in allowlist')
                          }
                        }
                      } catch {
                        setEditIpError('Could not detect IP')
                      } finally {
                        setDetectingIp(false)
                      }
                    }}
                  >
                    {detectingIp ? (
                      <LoaderPinwheelIcon size={16} className="mr-1 animate-spin" />
                    ) : (
                      <Crosshair className="h-4 w-4 mr-1" />
                    )}
                    Detect IP
                  </Button>
                </div>
                {editIpError && (
                  <p className="text-xs text-red-400">{editIpError}</p>
                )}
              </div>

              {editIpAllowlist.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {editIpAllowlist.map((ip) => (
                    <Badge
                      key={ip}
                      variant="outline"
                      className="text-xs border-border text-muted-foreground pl-2 pr-1 py-1 flex items-center gap-1"
                    >
                      {ip}
                      <button
                        type="button"
                        onClick={() => setEditIpAllowlist((prev) => prev.filter((i) => i !== ip))}
                        className="rounded-full hover:bg-zinc-700 p-0.5 transition-colors"
                        aria-label={`Remove ${ip}`}
                      >
                        <XIcon size={14} />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Fallback Routing Section */}
            <div className="space-y-4">
              <div {...fallbackRefreshHandlers}>
                <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                  <RefreshCWIcon ref={fallbackRefreshRef} size={16} className="text-primary" />
                  Fallback Routing
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Automatically retry failed requests with an alternative provider.
                </p>
              </div>

              {editFallbackRules.length > 0 && (
                <div className="space-y-3">
                  {editFallbackRules.map((rule, index) => (
                    <div
                      key={index}
                      className="rounded-md border border-border p-3 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground font-medium">Rule {index + 1}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-red-400"
                          onClick={() => {
                            setEditFallbackRules((prev) => prev.filter((_, i) => i !== index))
                          }}
                          aria-label={`Remove fallback rule ${index + 1}`}
                        >
                          <DeleteIcon size={14} />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Primary Provider</Label>
                          <Select
                            value={rule.primaryProvider}
                            onValueChange={(v) => {
                              if (!v) return
                              setEditFallbackRules((prev) =>
                                prev.map((r, i) =>
                                  i === index ? { ...r, primaryProvider: v } : r
                                )
                              )
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              {PROVIDER_OPTIONS.filter((p) => p.value !== rule.fallbackProvider).map((p) => (
                                <SelectItem key={p.value} value={p.value}>
                                  {p.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Fallback Provider</Label>
                          <Select
                            value={rule.fallbackProvider}
                            onValueChange={(v) => {
                              if (!v) return
                              setEditFallbackRules((prev) =>
                                prev.map((r, i) =>
                                  i === index ? { ...r, fallbackProvider: v } : r
                                )
                              )
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              {PROVIDER_OPTIONS.filter((p) => p.value !== rule.primaryProvider).map((p) => (
                                <SelectItem key={p.value} value={p.value}>
                                  {p.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Trigger on Status Codes</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {FALLBACK_STATUS_OPTIONS.map((opt) => {
                            const active = rule.triggerOnStatus.includes(opt.value)
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                className={`rounded-md border px-2 py-0.5 text-xs transition-colors ${
                                  active
                                    ? 'border-lime-400/40 bg-primary/10 text-primary'
                                    : 'border-border text-muted-foreground hover:border-zinc-600'
                                }`}
                                onClick={() => {
                                  setEditFallbackRules((prev) =>
                                    prev.map((r, i) =>
                                      i === index
                                        ? {
                                            ...r,
                                            triggerOnStatus: active
                                              ? r.triggerOnStatus.filter((s) => s !== opt.value)
                                              : [...r.triggerOnStatus, opt.value],
                                          }
                                        : r
                                    )
                                  )
                                }}
                              >
                                {opt.value}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setEditFallbackRules((prev) => [
                    ...prev,
                    {
                      primaryProvider: '',
                      fallbackProvider: '',
                      triggerOnStatus: [429, 500, 503],
                      priority: prev.length,
                    },
                  ])
                }}
              >
                <PlusIcon size={16} className="mr-1" />
                Add Fallback Rule
              </Button>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditKey(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={editSaving}>
                {editSaving && <LoaderPinwheelIcon size={16} className="mr-2 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) { setDeleteId(null); setDeleting(false) } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete platform key?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Any applications using this key will immediately stop working.
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
