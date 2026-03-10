'use client'

import { useEffect, useState } from 'react'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { PlusIcon } from '@/components/ui/plus'
import { WebhookIcon } from '@/components/ui/webhook'
import { LoaderPinwheelIcon } from '@/components/ui/loader-pinwheel'
import { DeleteIcon } from '@/components/ui/delete'
import { CopyIcon } from '@/components/ui/copy'
import { CheckIcon } from '@/components/ui/check'
import { SendIcon } from '@/components/ui/send'
import { BadgeAlertIcon } from '@/components/ui/badge-alert'
import { ChevronDownIcon } from '@/components/ui/chevron-down'
import { ChevronUpIcon } from '@/components/ui/chevron-up'
import { HistoryIcon } from '@/components/ui/history'
import { useAnimatedIcon } from '@/hooks/use-animated-icon'
import { apiFetch } from '@/lib/fetch'

const EVENT_TYPES = [
  { value: 'budget.threshold', label: 'Budget Threshold' },
  { value: 'budget.exhausted', label: 'Budget Exhausted' },
  { value: 'key.expired', label: 'Key Expired' },
  { value: 'key.expiring_soon', label: 'Key Expiring Soon' },
  { value: 'anomaly.detected', label: 'Anomaly Detected' },
  { value: 'request.error', label: 'Request Error' },
]

interface WebhookDelivery {
  id: string
  event: string
  statusCode: number | null
  responseBody: string | null
  attemptCount: number
  deliveredAt: string | null
  failedAt: string | null
  createdAt: string
}

interface WebhookEndpoint {
  id: string
  url: string
  secret: string
  events: string[]
  active: boolean
  failures: number
  createdAt: string
  _count: { deliveries: number }
}

export default function WebhooksPage() {
  const { iconRef: webhookIconRef, handlers: webhookIconHandlers } = useAnimatedIcon()
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [newEvents, setNewEvents] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [showSecretOpen, setShowSecretOpen] = useState(false)
  const [newSecret, setNewSecret] = useState('')
  const { copy, copied } = useCopyToClipboard()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null)
  const [deliveries, setDeliveries] = useState<Record<string, WebhookDelivery[]>>({})
  const [loadingDeliveries, setLoadingDeliveries] = useState<string | null>(null)
  const { addToast } = useToast()

  async function fetchEndpoints() {
    try {
      const res = await fetch('/api/webhooks')
      if (!res.ok) throw new Error('Failed to load webhooks')
      const data = await res.json()
      setEndpoints(data)
    } catch {
      addToast({ title: 'Failed to load webhooks', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchEndpoints() }, [])

  async function toggleDeliveryHistory(endpointId: string) {
    if (expandedEndpoint === endpointId) {
      setExpandedEndpoint(null)
      return
    }
    setExpandedEndpoint(endpointId)
    if (!deliveries[endpointId]) {
      setLoadingDeliveries(endpointId)
      try {
        const res = await fetch(`/api/webhooks?endpointId=${endpointId}`)
        if (res.ok) {
          const data = await res.json()
          setDeliveries((prev) => ({ ...prev, [endpointId]: data }))
        }
      } catch {
        addToast({ title: 'Failed to load delivery history', variant: 'destructive' })
      } finally {
        setLoadingDeliveries(null)
      }
    }
  }

  function toggleEvent(event: string) {
    setNewEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    )
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (newEvents.length === 0) {
      addToast({ title: 'Select at least one event', variant: 'destructive' })
      return
    }
    setSaving(true)

    try {
      const res = await apiFetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl, events: newEvents }),
      })

      if (res.ok) {
        const data = await res.json()
        setNewSecret(data.secret)
        setCreateOpen(false)
        setShowSecretOpen(true)
        setNewUrl('')
        setNewEvents([])
        fetchEndpoints()
      } else {
        const data = await res.json()
        addToast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch {
      addToast({ title: 'Network error', description: 'Could not reach server', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(id: string, active: boolean) {
    setTogglingId(id)
    try {
      const res = await apiFetch('/api/webhooks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, active }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        addToast({ title: 'Failed to update webhook', description: data.error || 'Something went wrong', variant: 'destructive' })
      }
      fetchEndpoints()
    } catch {
      addToast({ title: 'Network error', description: 'Could not reach server', variant: 'destructive' })
    } finally {
      setTogglingId(null)
    }
  }

  async function handleTest(id: string) {
    setTestingId(id)
    try {
      const res = await apiFetch('/api/webhooks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, test: true }),
      })
      if (res.ok) {
        addToast({ title: 'Ping sent', description: 'Test event dispatched to webhook endpoint.', variant: 'success' })
      } else {
        addToast({ title: 'Ping failed', description: 'Could not send test event.', variant: 'destructive' })
      }
    } catch {
      addToast({ title: 'Network error', description: 'Could not reach server', variant: 'destructive' })
    } finally {
      setTestingId(null)
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await apiFetch(`/api/webhooks?id=${deleteId}`, { method: 'DELETE' })
      if (res.ok) {
        addToast({ title: 'Webhook deleted', variant: 'default' })
        setDeleteId(null)
        fetchEndpoints()
      } else {
        const data = await res.json().catch(() => ({}))
        addToast({ title: 'Failed to delete webhook', description: data.error || 'Something went wrong', variant: 'destructive' })
      }
    } catch {
      addToast({ title: 'Network error', description: 'Could not reach server', variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  async function copySecret() {
    await copy(newSecret)
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Webhooks</h1>
          <p className="text-muted-foreground">Receive real-time notifications for important events</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <PlusIcon size={16} className="mr-2" />
          Add Endpoint
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : endpoints.length === 0 ? (
        <Card {...webhookIconHandlers}>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <WebhookIcon ref={webhookIconRef} size={48} className="text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">No webhook endpoints yet. Add one to receive event notifications.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {endpoints.map((endpoint) => (
            <Card key={endpoint.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-foreground text-base font-mono truncate">
                        {endpoint.url}
                      </CardTitle>
                      <Badge
                        variant={endpoint.active ? 'default' : 'secondary'}
                        className={endpoint.active ? 'bg-primary/10 text-primary' : undefined}
                      >
                        {endpoint.active ? 'Active' : 'Inactive'}
                      </Badge>
                      {endpoint.failures > 0 && (
                        <Badge variant="destructive" className="gap-1">
                          <BadgeAlertIcon size={12} />
                          {endpoint.failures} failures
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="mt-1">
                      {endpoint._count.deliveries} deliveries &middot; Created {new Date(endpoint.createdAt).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest(endpoint.id)}
                      disabled={testingId === endpoint.id}
                      className="gap-1.5"
                    >
                      {testingId === endpoint.id ? (
                        <LoaderPinwheelIcon size={12} className="animate-spin" />
                      ) : (
                        <SendIcon size={12} />
                      )}
                      Test
                    </Button>
                    {togglingId === endpoint.id ? (
                      <LoaderPinwheelIcon size={16} className="animate-spin text-muted-foreground" />
                    ) : (
                      <Switch
                        checked={endpoint.active}
                        onCheckedChange={(checked) => handleToggle(endpoint.id, checked)}
                        aria-label={`Toggle ${endpoint.url} ${endpoint.active ? 'off' : 'on'}`}
                      />
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(endpoint.id)}
                      className="text-muted-foreground hover:text-red-400"
                      aria-label={`Delete webhook ${endpoint.url}`}
                    >
                      <DeleteIcon size={16} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {endpoint.events.map((event) => (
                    <Badge key={event} variant="secondary" className="text-xs">
                      {event}
                    </Badge>
                  ))}
                </div>

                {/* Delivery History Toggle */}
                <button
                  type="button"
                  onClick={() => toggleDeliveryHistory(endpoint.id)}
                  aria-expanded={expandedEndpoint === endpoint.id}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-muted-foreground transition-colors"
                >
                  <HistoryIcon size={12} />
                  Delivery History
                  {expandedEndpoint === endpoint.id ? (
                    <ChevronUpIcon size={12} />
                  ) : (
                    <ChevronDownIcon size={12} />
                  )}
                </button>

                {expandedEndpoint === endpoint.id && (
                  <div className="rounded-lg border border-border overflow-hidden">
                    {loadingDeliveries === endpoint.id ? (
                      <div className="flex items-center justify-center py-6">
                        <LoaderPinwheelIcon size={16} className="animate-spin text-muted-foreground" />
                      </div>
                    ) : (deliveries[endpoint.id]?.length ?? 0) === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">No deliveries yet</p>
                    ) : (
                      <div className="max-h-[300px] overflow-y-auto divide-y divide-zinc-800">
                        {deliveries[endpoint.id]?.map((d) => (
                          <div key={d.id} className="px-3 py-2 text-xs">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={d.deliveredAt ? 'default' : 'destructive'}
                                  className={`text-[10px] ${d.deliveredAt ? 'bg-primary/10 text-primary' : ''}`}
                                >
                                  {d.deliveredAt ? 'OK' : 'Failed'}
                                </Badge>
                                <span className="text-muted-foreground font-medium">{d.event}</span>
                                {d.statusCode && (
                                  <span className="text-muted-foreground">HTTP {d.statusCode}</span>
                                )}
                                {d.attemptCount > 1 && (
                                  <span className="text-muted-foreground">{d.attemptCount} attempts</span>
                                )}
                              </div>
                              <span className="text-muted-foreground">
                                {new Date(d.createdAt).toLocaleString()}
                              </span>
                            </div>
                            {d.responseBody && !d.deliveredAt && (
                              <pre className="mt-1 rounded bg-muted px-2 py-1 text-[10px] text-muted-foreground overflow-x-auto max-w-full truncate">
                                {d.responseBody.slice(0, 200)}
                              </pre>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Endpoint Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Webhook Endpoint</DialogTitle>
            <DialogDescription>
              Configure a URL to receive event notifications via HTTP POST.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wh-url">Endpoint URL</Label>
              <Input
                id="wh-url"
                type="url"
                placeholder="https://example.com/webhooks"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                required
              />
            </div>
            <div className="space-y-3">
              <Label>Events</Label>
              <div className="grid grid-cols-2 gap-3">
                {EVENT_TYPES.map((event) => (
                  <label
                    key={event.value}
                    className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground"
                  >
                    <Checkbox
                      checked={newEvents.includes(event.value)}
                      onCheckedChange={() => toggleEvent(event.value)}
                    />
                    {event.label}
                  </label>
                ))}
              </div>
              {newEvents.length === 0 && (
                <p className="text-xs text-muted-foreground">Select at least one event type.</p>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <LoaderPinwheelIcon size={16} className="mr-2 animate-spin" />}
                Create Endpoint
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Show Secret Dialog */}
      <Dialog open={showSecretOpen} onOpenChange={setShowSecretOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Webhook Secret</DialogTitle>
            <DialogDescription>
              This secret will only be shown once. Copy it now to verify webhook signatures.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <code className="block w-full break-all rounded-lg border border-border bg-muted p-4 text-sm text-foreground">
                {newSecret}
              </code>
            </div>
            <p className="text-xs text-muted-foreground">
              Use this secret to verify the <code className="text-muted-foreground">X-KeyHub-Signature</code> header on incoming webhook requests.
            </p>
            <div className="flex justify-end gap-3">
              <Button onClick={copySecret} variant="outline">
                {copied ? (
                  <CheckIcon size={16} className="mr-2 text-primary" />
                ) : (
                  <CopyIcon size={16} className="mr-2" />
                )}
                {copied ? 'Copied!' : 'Copy Secret'}
              </Button>
              <Button onClick={() => { setShowSecretOpen(false); setNewSecret('') }}>
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) { setDeleteId(null); setDeleting(false) } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete webhook endpoint?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The endpoint will stop receiving all event notifications.
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
