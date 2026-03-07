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
import { useToast } from '@/components/ui/toast'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Trash2, KeyRound, Loader2 } from 'lucide-react'

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
  createdAt: string
}

export default function ProviderKeysPage() {
  const [keys, setKeys] = useState<ProviderKey[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [provider, setProvider] = useState('')
  const [label, setLabel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const { addToast } = useToast()

  async function fetchKeys() {
    const res = await fetch('/api/keys/provider')
    const data = await res.json()
    setKeys(data)
    setLoading(false)
  }

  useEffect(() => { fetchKeys() }, [])

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
    await fetch('/api/keys/provider', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isActive }),
    })
    fetchKeys()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this provider key? This cannot be undone.')) return

    await fetch(`/api/keys/provider?id=${id}`, { method: 'DELETE' })
    addToast({ title: 'Key deleted', variant: 'default' })
    fetchKeys()
  }

  const providerLabel = (p: string) =>
    PROVIDERS.find((x) => x.value === p)?.label || p

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Provider Keys</h1>
          <p className="text-zinc-400">Manage your real AI provider API keys</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
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
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <KeyRound className="h-12 w-12 text-zinc-600 mb-4" />
            <p className="text-zinc-400 text-center">No provider keys yet. Add your first API key to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {keys.map((key) => (
            <Card key={key.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base text-zinc-100">{key.label}</CardTitle>
                  <CardDescription className="mt-1">
                    {providerLabel(key.provider)}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={key.isActive ? 'success' : 'secondary'}>
                    {key.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">
                    Added {new Date(key.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={key.isActive}
                    onCheckedChange={(checked) => handleToggle(key.id, checked)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(key.id)}
                    className="text-zinc-500 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
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
              <Select value={provider} onValueChange={setProvider}>
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
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Key
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
