'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Copy, Shield, Loader2, Trash2, Check } from 'lucide-react'

interface PlatformKey {
  id: string
  label: string
  keyPrefix: string
  isActive: boolean
  lastUsedAt: string | null
  createdAt: string
  _count: { logs: number }
}

export default function PlatformKeysPage() {
  const [keys, setKeys] = useState<PlatformKey[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [showKeyOpen, setShowKeyOpen] = useState(false)
  const [newKeyLabel, setNewKeyLabel] = useState('')
  const [newRawKey, setNewRawKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const { addToast } = useToast()

  async function fetchKeys() {
    const res = await fetch('/api/keys/platform')
    const data = await res.json()
    setKeys(data)
    setLoading(false)
  }

  useEffect(() => { fetchKeys() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const res = await fetch('/api/keys/platform', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newKeyLabel }),
    })

    if (res.ok) {
      const data = await res.json()
      setNewRawKey(data.rawKey)
      setCreateOpen(false)
      setShowKeyOpen(true)
      setNewKeyLabel('')
      fetchKeys()
    } else {
      const data = await res.json()
      addToast({ title: 'Error', description: data.error, variant: 'destructive' })
    }
    setSaving(false)
  }

  async function handleToggle(id: string, isActive: boolean) {
    await fetch('/api/keys/platform', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isActive }),
    })
    fetchKeys()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this platform key? Any apps using it will stop working.')) return
    await fetch(`/api/keys/platform?id=${id}`, { method: 'DELETE' })
    addToast({ title: 'Key deleted', variant: 'default' })
    fetchKeys()
  }

  function copyKey() {
    navigator.clipboard.writeText(newRawKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Platform Keys</h1>
          <p className="text-zinc-400">Virtual API keys for your applications</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
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
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="h-12 w-12 text-zinc-600 mb-4" />
            <p className="text-zinc-400 text-center">No platform keys yet. Create one to start using the API.</p>
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
                <TableHead>Requests</TableHead>
                <TableHead>Last Used</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium text-zinc-100">{key.label}</TableCell>
                  <TableCell>
                    <code className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
                      {key.keyPrefix}...
                    </code>
                  </TableCell>
                  <TableCell>
                    <Badge variant={key.isActive ? 'success' : 'secondary'}>
                      {key.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-zinc-400">{key._count.logs}</TableCell>
                  <TableCell className="text-zinc-400">
                    {key.lastUsedAt
                      ? new Date(key.lastUsedAt).toLocaleDateString()
                      : 'Never'}
                  </TableCell>
                  <TableCell className="text-zinc-400">
                    {new Date(key.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
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
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
              <code className="block w-full break-all rounded-lg border border-zinc-700 bg-zinc-900 p-4 text-sm text-zinc-100">
                {newRawKey}
              </code>
            </div>
            <div className="flex justify-end gap-3">
              <Button onClick={copyKey} variant="outline">
                {copied ? (
                  <Check className="mr-2 h-4 w-4 text-emerald-500" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
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
    </div>
  )
}
