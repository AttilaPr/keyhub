'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/fetch'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
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
import { useToast } from '@/components/ui/toast'
import { LoaderPinwheelIcon } from '@/components/ui/loader-pinwheel'
import { ChevronLeftIcon } from '@/components/ui/chevron-left'
import { ChevronRightIcon } from '@/components/ui/chevron-right'
import { DeleteIcon } from '@/components/ui/delete'
import { BanIcon } from '@/components/ui/ban'
import { BadgeAlertIcon } from '@/components/ui/badge-alert'

interface AffectedKey {
  id: string
  keyPrefix: string
  label: string
  ownerEmail: string
  ownerName: string | null
  wasActive: boolean
}

export default function AdminKeysPage() {
  const [tab, setTab] = useState('platform')
  const [keys, setKeys] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const { addToast } = useToast()

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string; type: string } | null>(null)
  const [deleteReason, setDeleteReason] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Revoke state
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; label: string; keyPrefix: string } | null>(null)
  const [revoking, setRevoking] = useState(false)

  // Leaked key state
  const [leakedKeyOpen, setLeakedKeyOpen] = useState(false)
  const [leakedPrefix, setLeakedPrefix] = useState('')
  const [leakedSearching, setLeakedSearching] = useState(false)
  const [leakedResult, setLeakedResult] = useState<{ affectedCount: number; affectedKeys: AffectedKey[] } | null>(null)

  function fetchKeys() {
    setLoading(true)
    fetch(`/api/admin/keys?type=${tab}&page=${page}&limit=20`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed')
        return res.json()
      })
      .then((data) => {
        setKeys(data.keys)
        setTotal(data.total)
      })
      .catch(() => addToast({ title: 'Failed to load keys', variant: 'destructive' }))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchKeys() }, [tab, page])

  async function handleToggle(id: string, isActive: boolean) {
    setToggling(id)
    try {
      const res = await apiFetch('/api/admin/keys', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, type: tab, isActive: !isActive }),
      })
      if (!res.ok) throw new Error()
      fetchKeys()
    } catch {
      addToast({ title: 'Failed to toggle key', variant: 'destructive' })
    } finally {
      setToggling(null)
    }
  }

  async function handleDelete() {
    if (!deleteTarget || !deleteReason.trim()) return
    setDeleting(true)
    try {
      const res = await apiFetch('/api/admin/keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteTarget.id, type: deleteTarget.type, reason: deleteReason.trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete key')
      }
      addToast({ title: 'Key deleted', variant: 'success' })
      setDeleteTarget(null)
      setDeleteReason('')
      fetchKeys()
    } catch (err: unknown) {
      addToast({ title: err instanceof Error ? err.message : 'Failed to delete key', variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  async function handleRevoke() {
    if (!revokeTarget) return
    setRevoking(true)
    try {
      const res = await apiFetch('/api/admin/keys/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: revokeTarget.id }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to revoke key')
      }
      addToast({ title: 'Key revoked', description: 'Key will return 401 on all future requests', variant: 'success' })
      setRevokeTarget(null)
      fetchKeys()
    } catch (err: unknown) {
      addToast({ title: err instanceof Error ? err.message : 'Failed to revoke key', variant: 'destructive' })
    } finally {
      setRevoking(false)
    }
  }

  async function handleLeakedKey() {
    if (!leakedPrefix.trim() || leakedPrefix.trim().length < 3) {
      addToast({ title: 'Prefix must be at least 3 characters', variant: 'destructive' })
      return
    }
    setLeakedSearching(true)
    try {
      const res = await apiFetch('/api/admin/incident/leaked-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyPrefix: leakedPrefix.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to process leaked key')
      }
      setLeakedResult(data)
      addToast({
        title: `${data.affectedCount} key(s) disabled`,
        description: 'All matching keys have been revoked',
        variant: 'success',
      })
      fetchKeys()
    } catch (err: unknown) {
      addToast({ title: err instanceof Error ? err.message : 'Failed to process leaked key', variant: 'destructive' })
    } finally {
      setLeakedSearching(false)
    }
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Key Management</h1>
          <p className="text-muted-foreground">Platform-wide key overview</p>
        </div>
        <Button
          variant="destructive"
          onClick={() => {
            setLeakedKeyOpen(true)
            setLeakedPrefix('')
            setLeakedResult(null)
          }}
        >
          <BadgeAlertIcon size={16} className="mr-2" />
          Leaked Key Response
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v); setPage(1) }}>
        <TabsList>
          <TabsTrigger value="platform">Platform Keys</TabsTrigger>
          <TabsTrigger value="provider">Provider Keys</TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Owner</TableHead>
                    <TableHead>{tab === 'platform' ? 'Label' : 'Provider'}</TableHead>
                    <TableHead>Status</TableHead>
                    {tab === 'platform' && <TableHead className="text-right">Requests</TableHead>}
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={tab === 'platform' ? 7 : 6}><Skeleton className="h-8 w-full" /></TableCell>
                      </TableRow>
                    ))
                  ) : keys.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={tab === 'platform' ? 7 : 6} className="text-center text-muted-foreground py-8">No keys found</TableCell>
                    </TableRow>
                  ) : (
                    keys.map((key: any) => (
                      <TableRow key={key.id}>
                        <TableCell>
                          <p className="text-xs text-muted-foreground">{key.user?.name || key.user?.email}</p>
                          <p className="text-[10px] text-muted-foreground">{key.user?.email}</p>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {tab === 'platform' ? key.label : key.provider}
                          {tab === 'platform' && (
                            <p className="text-[10px] text-muted-foreground font-mono">{key.keyPrefix}...</p>
                          )}
                        </TableCell>
                        <TableCell>
                          {key.revokedAt ? (
                            <Badge className="bg-red-500/10 text-red-400">Revoked</Badge>
                          ) : (
                            <Badge className={key.isActive ? 'bg-primary/10 text-primary' : 'bg-card text-muted-foreground'}>
                              {key.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          )}
                        </TableCell>
                        {tab === 'platform' && (
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {key._count?.logs?.toLocaleString() ?? 0}
                          </TableCell>
                        )}
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(key.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {toggling === key.id ? (
                            <LoaderPinwheelIcon size={16} className="animate-spin text-muted-foreground ml-auto" />
                          ) : (
                            <Switch
                              checked={key.isActive}
                              onCheckedChange={() => handleToggle(key.id, key.isActive)}
                              disabled={!!key.revokedAt}
                            />
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {tab === 'platform' && !key.revokedAt && (
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10"
                                onClick={() => setRevokeTarget({ id: key.id, label: key.label, keyPrefix: key.keyPrefix })}
                                title="Revoke key"
                              >
                                <BanIcon size={16} />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                              onClick={() => setDeleteTarget({ id: key.id, label: tab === 'platform' ? key.label : key.provider, type: tab })}
                              title="Delete key"
                            >
                              <DeleteIcon size={16} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeftIcon size={16} />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              <ChevronRightIcon size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* Delete Key AlertDialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteReason('') } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Key</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the key &quot;{deleteTarget?.label}&quot; and all associated request logs. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-sm text-muted-foreground">Reason / Justification</Label>
            <Textarea
              placeholder="Why is this key being deleted?"
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              className="min-h-20"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting || !deleteReason.trim()}
              className="bg-red-600 text-foreground hover:bg-red-700"
            >
              {deleting && <LoaderPinwheelIcon size={16} className="mr-2 animate-spin" />}
              Delete Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke Key AlertDialog */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(open) => { if (!open) setRevokeTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Platform Key</AlertDialogTitle>
            <AlertDialogDescription>
              Revoking &quot;{revokeTarget?.label}&quot; ({revokeTarget?.keyPrefix}...) will immediately disable it and return 401 on all future API requests. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={revoking}
              className="bg-yellow-600 text-foreground hover:bg-yellow-700"
            >
              {revoking && <LoaderPinwheelIcon size={16} className="mr-2 animate-spin" />}
              Revoke Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leaked Key Response Dialog */}
      <Dialog open={leakedKeyOpen} onOpenChange={(open) => { if (!open) { setLeakedKeyOpen(false); setLeakedPrefix(''); setLeakedResult(null) } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BadgeAlertIcon size={20} className="text-red-400" />
              Leaked Key Response
            </DialogTitle>
            <DialogDescription>
              Enter a key prefix to search and disable all matching platform keys. This is an incident response action.
            </DialogDescription>
          </DialogHeader>

          {!leakedResult ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Key Prefix</Label>
                <Input
                  placeholder="e.g. ak-user-abc123"
                  value={leakedPrefix}
                  onChange={(e) => setLeakedPrefix(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Minimum 3 characters. All platform keys matching this prefix will be disabled.</p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setLeakedKeyOpen(false)}>Cancel</Button>
                <Button
                  variant="destructive"
                  onClick={handleLeakedKey}
                  disabled={leakedSearching || leakedPrefix.trim().length < 3}
                >
                  {leakedSearching && <LoaderPinwheelIcon size={16} className="mr-2 animate-spin" />}
                  Search &amp; Disable
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-red-800 bg-red-950/30 p-3">
                <p className="text-sm font-medium text-red-300">
                  {leakedResult.affectedCount} key(s) disabled
                </p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key Prefix</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Was Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leakedResult.affectedKeys.map((k) => (
                    <TableRow key={k.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{k.keyPrefix}...</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{k.label}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{k.ownerEmail}</TableCell>
                      <TableCell>
                        <Badge className={k.wasActive ? 'bg-primary/10 text-primary' : 'bg-card text-muted-foreground'}>
                          {k.wasActive ? 'Yes' : 'No'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => { setLeakedKeyOpen(false); setLeakedPrefix(''); setLeakedResult(null) }}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
