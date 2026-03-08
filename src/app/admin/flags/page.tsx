'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { Sprout, Flag } from 'lucide-react'
import { PlusIcon } from '@/components/ui/plus'
import { DeleteIcon } from '@/components/ui/delete'
import { LoaderPinwheelIcon } from '@/components/ui/loader-pinwheel'

interface FeatureFlag {
  id: string
  key: string
  description: string | null
  enabled: boolean
  rolloutPercent: number
  allowedUserIds: string[]
  allowedPlanIds: string[]
  updatedAt: string
  updatedBy: string | null
}

export default function AdminFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [editingRollout, setEditingRollout] = useState<Record<string, string>>({})
  const [editingUsers, setEditingUsers] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const { addToast } = useToast()

  function fetchFlags() {
    setLoading(true)
    fetch('/api/admin/flags')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load flags')
        return res.json()
      })
      .then((data) => {
        setFlags(data.flags)
        // Initialize editing state
        const rollouts: Record<string, string> = {}
        const users: Record<string, string> = {}
        for (const f of data.flags) {
          rollouts[f.key] = String(f.rolloutPercent)
          users[f.key] = f.allowedUserIds.join(', ')
        }
        setEditingRollout(rollouts)
        setEditingUsers(users)
      })
      .catch(() => {
        addToast({ title: 'Failed to load feature flags', variant: 'destructive' })
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchFlags()
  }, [])

  async function handleToggle(key: string, enabled: boolean) {
    setToggling(key)
    try {
      const res = await fetch(`/api/admin/flags/${key}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })
      if (!res.ok) throw new Error('Failed to update flag')
      setFlags((prev) =>
        prev.map((f) => (f.key === key ? { ...f, enabled } : f))
      )
      addToast({ title: `${key} ${enabled ? 'enabled' : 'disabled'}`, variant: 'success' })
    } catch {
      addToast({ title: 'Failed to update flag', variant: 'destructive' })
    } finally {
      setToggling(null)
    }
  }

  async function handleSaveRollout(key: string) {
    const percent = parseInt(editingRollout[key] ?? '0', 10)
    if (isNaN(percent) || percent < 0 || percent > 100) {
      addToast({ title: 'Rollout must be 0-100', variant: 'destructive' })
      return
    }
    setSaving(key)
    try {
      const res = await fetch(`/api/admin/flags/${key}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rolloutPercent: percent }),
      })
      if (!res.ok) throw new Error('Failed to update rollout')
      setFlags((prev) =>
        prev.map((f) => (f.key === key ? { ...f, rolloutPercent: percent } : f))
      )
      addToast({ title: `Rollout updated to ${percent}%`, variant: 'success' })
    } catch {
      addToast({ title: 'Failed to update rollout', variant: 'destructive' })
    } finally {
      setSaving(null)
    }
  }

  async function handleSaveUsers(key: string) {
    const raw = editingUsers[key] ?? ''
    const userIds = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    setSaving(key)
    try {
      const res = await fetch(`/api/admin/flags/${key}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowedUserIds: userIds }),
      })
      if (!res.ok) throw new Error('Failed to update user allowlist')
      setFlags((prev) =>
        prev.map((f) => (f.key === key ? { ...f, allowedUserIds: userIds } : f))
      )
      addToast({ title: 'User allowlist updated', variant: 'success' })
    } catch {
      addToast({ title: 'Failed to update user allowlist', variant: 'destructive' })
    } finally {
      setSaving(null)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newKey.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/admin/flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: newKey.trim(), description: newDescription.trim() || undefined }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create flag')
      }
      addToast({ title: `Flag "${newKey.trim()}" created`, variant: 'success' })
      setNewKey('')
      setNewDescription('')
      setCreateOpen(false)
      fetchFlags()
    } catch (err) {
      addToast({
        title: err instanceof Error ? err.message : 'Failed to create flag',
        variant: 'destructive',
      })
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(key: string) {
    setDeleting(key)
    try {
      const res = await fetch(`/api/admin/flags/${key}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete flag')
      setFlags((prev) => prev.filter((f) => f.key !== key))
      addToast({ title: `Flag "${key}" deleted`, variant: 'success' })
    } catch {
      addToast({ title: 'Failed to delete flag', variant: 'destructive' })
    } finally {
      setDeleting(null)
    }
  }

  async function handleSeed() {
    setSeeding(true)
    try {
      const res = await fetch('/api/admin/flags/seed', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to seed flags')
      const data = await res.json()
      addToast({
        title: `Seeded ${data.created} flags (${data.skipped} already existed)`,
        variant: 'success',
      })
      fetchFlags()
    } catch {
      addToast({ title: 'Failed to seed default flags', variant: 'destructive' })
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Feature Flags</h1>
          <p className="text-muted-foreground">Manage feature rollouts and access controls</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSeed} disabled={seeding}>
            {seeding ? <LoaderPinwheelIcon size={16} className="mr-2 animate-spin" /> : <Sprout className="mr-2 h-4 w-4" />}
            Seed Defaults
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <PlusIcon size={16} className="mr-2" />
            New Flag
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Flag</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rollout %</TableHead>
                <TableHead>User Allowlist</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-10 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : flags.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center gap-3">
                      <Flag className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">No feature flags yet</p>
                      <p className="text-xs text-muted-foreground">
                        Create a flag or seed defaults to get started
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                flags.map((flag) => (
                  <TableRow key={flag.id}>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium font-mono text-foreground">{flag.key}</p>
                        {flag.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{flag.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={flag.enabled}
                          onCheckedChange={(checked) => handleToggle(flag.key, checked)}
                          disabled={toggling === flag.key}
                        />
                        <Badge
                          className={
                            flag.enabled
                              ? 'bg-primary/10 text-primary'
                              : 'bg-card text-muted-foreground'
                          }
                        >
                          {flag.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={editingRollout[flag.key] ?? String(flag.rolloutPercent)}
                          onChange={(e) =>
                            setEditingRollout((prev) => ({
                              ...prev,
                              [flag.key]: e.target.value,
                            }))
                          }
                          className="w-20 text-sm"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRollout(flag.key)
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSaveRollout(flag.key)}
                          disabled={
                            saving === flag.key ||
                            editingRollout[flag.key] === String(flag.rolloutPercent)
                          }
                          className="text-xs"
                        >
                          {saving === flag.key ? (
                            <LoaderPinwheelIcon size={16} className="animate-spin" />
                          ) : (
                            'Save'
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 max-w-[240px]">
                        <Input
                          value={editingUsers[flag.key] ?? flag.allowedUserIds.join(', ')}
                          onChange={(e) =>
                            setEditingUsers((prev) => ({
                              ...prev,
                              [flag.key]: e.target.value,
                            }))
                          }
                          placeholder="user1, user2, ..."
                          className="text-xs"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveUsers(flag.key)
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSaveUsers(flag.key)}
                          disabled={
                            saving === flag.key ||
                            editingUsers[flag.key] === flag.allowedUserIds.join(', ')
                          }
                          className="text-xs"
                        >
                          {saving === flag.key ? (
                            <LoaderPinwheelIcon size={16} className="animate-spin" />
                          ) : (
                            'Save'
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(flag.updatedAt).toLocaleDateString()}
                        </p>
                        {flag.updatedBy && (
                          <p className="text-xs text-muted-foreground">{flag.updatedBy}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger
                          render={
                            <Button variant="ghost" size="sm" aria-label="Delete flag">
                              <DeleteIcon size={16} className="text-red-400" />
                            </Button>
                          }
                        />
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete flag?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete the <strong>{flag.key}</strong> feature
                              flag. Any code referencing this flag will default to disabled.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <Button
                              variant="destructive"
                              onClick={() => handleDelete(flag.key)}
                              disabled={deleting === flag.key}
                            >
                              {deleting === flag.key && (
                                <LoaderPinwheelIcon size={16} className="mr-2 animate-spin" />
                              )}
                              Delete
                            </Button>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Flag Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Feature Flag</DialogTitle>
            <DialogDescription>
              Add a new feature flag. The key must be lowercase with underscores.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="flag-key">Flag Key</Label>
              <Input
                id="flag-key"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="e.g. new_feature"
                pattern="^[a-z][a-z0-9_]*$"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="flag-desc">Description</Label>
              <Input
                id="flag-desc"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="What this flag controls..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating || !newKey.trim()}>
                {creating && <LoaderPinwheelIcon size={16} className="mr-2 animate-spin" />}
                Create Flag
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
