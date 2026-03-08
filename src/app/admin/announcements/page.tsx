'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { useToast } from '@/components/ui/toast'
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Megaphone,
  Info,
  AlertTriangle,
  AlertOctagon,
} from 'lucide-react'

interface Announcement {
  id: string
  title: string
  body: string
  type: string
  targetRole: string
  publishedAt: string
  expiresAt: string | null
  createdAt: string
  createdBy: string
  creator: { id: string; name: string | null; email: string }
  _count: { dismissals: number }
}

const typeIcons: Record<string, React.ReactNode> = {
  info: <Info className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-400" />,
  critical: <AlertOctagon className="h-4 w-4 text-red-400" />,
}

const typeBadgeStyles: Record<string, string> = {
  info: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  warning: 'bg-amber-500/10 text-amber-400',
  critical: 'bg-red-500/10 text-red-400',
}

function isExpired(ann: Announcement) {
  if (!ann.expiresAt) return false
  return new Date(ann.expiresAt) < new Date()
}

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [type, setType] = useState('info')
  const [targetRole, setTargetRole] = useState('all')
  const [expiresAt, setExpiresAt] = useState('')

  const { addToast } = useToast()

  function fetchAnnouncements() {
    setLoading(true)
    fetch('/api/admin/announcements')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load announcements')
        return res.json()
      })
      .then((data) => setAnnouncements(data.announcements))
      .catch(() => {
        addToast({ title: 'Failed to load announcements', variant: 'destructive' })
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchAnnouncements()
  }, [])

  function resetForm() {
    setTitle('')
    setBody('')
    setType('info')
    setTargetRole('all')
    setExpiresAt('')
    setEditingId(null)
  }

  function openCreate() {
    resetForm()
    setDialogOpen(true)
  }

  function openEdit(ann: Announcement) {
    setEditingId(ann.id)
    setTitle(ann.title)
    setBody(ann.body)
    setType(ann.type)
    setTargetRole(ann.targetRole)
    setExpiresAt(ann.expiresAt ? ann.expiresAt.slice(0, 16) : '')
    setDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    try {
      const payload = {
        title,
        body,
        type,
        targetRole,
        expiresAt: expiresAt || null,
      }

      const url = editingId
        ? `/api/admin/announcements/${editingId}`
        : '/api/admin/announcements'
      const method = editingId ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save announcement')
      }

      addToast({
        title: editingId ? 'Announcement updated' : 'Announcement created',
        variant: 'success',
      })
      setDialogOpen(false)
      resetForm()
      fetchAnnouncements()
    } catch (err) {
      addToast({
        title: err instanceof Error ? err.message : 'Failed to save',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      const res = await fetch(`/api/admin/announcements/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      addToast({ title: 'Announcement deleted', variant: 'success' })
      fetchAnnouncements()
    } catch {
      addToast({ title: 'Failed to delete announcement', variant: 'destructive' })
    } finally {
      setDeleting(null)
    }
  }

  // Preview styles for the dialog
  const previewStyles: Record<string, { bg: string; border: string; text: string }> = {
    info: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', text: 'text-cyan-600 dark:text-cyan-300' },
    warning: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-300' },
    critical: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-300' },
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Announcements</h1>
          <p className="text-muted-foreground">
            Manage announcements shown to users across the platform
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          New Announcement
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Megaphone className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm">No announcements yet</p>
            <Button variant="outline" className="mt-4" onClick={openCreate}>
              Create your first announcement
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {announcements.map((ann) => {
            const expired = isExpired(ann)
            return (
              <Card key={ann.id} className={expired ? 'opacity-60' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      {typeIcons[ann.type]}
                      <CardTitle className="text-base">{ann.title}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={typeBadgeStyles[ann.type] || 'bg-card text-muted-foreground'}>
                        {ann.type}
                      </Badge>
                      <Badge className={
                        expired
                          ? 'bg-card text-muted-foreground'
                          : 'bg-primary/10 text-primary'
                      }>
                        {expired ? 'Expired' : 'Active'}
                      </Badge>
                      <Badge className="bg-card text-muted-foreground">
                        {ann.targetRole === 'all' ? 'All users' : 'Admins only'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{ann.body}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-4">
                      <span>
                        Created {new Date(ann.createdAt).toLocaleDateString()} by{' '}
                        {ann.creator.name || ann.creator.email}
                      </span>
                      {ann.expiresAt && (
                        <span>
                          Expires {new Date(ann.expiresAt).toLocaleDateString()}
                        </span>
                      )}
                      <span>{ann._count.dismissals} dismissal{ann._count.dismissals !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(ann)}
                        aria-label="Edit announcement"
                      >
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger
                          render={
                            <Button variant="ghost" size="sm" aria-label="Delete announcement">
                              <Trash2 className="h-4 w-4 text-red-400" />
                            </Button>
                          }
                        />
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete announcement?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete &quot;{ann.title}&quot; and all dismissal records.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <Button
                              variant="destructive"
                              onClick={() => handleDelete(ann.id)}
                              disabled={deleting === ann.id}
                            >
                              {deleting === ann.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              Delete
                            </Button>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm() } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Announcement' : 'Create Announcement'}</DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update the announcement details below.'
                : 'Create a new announcement to display to users.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ann-title">Title</Label>
              <Input
                id="ann-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Announcement title"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ann-body">Body</Label>
              <Textarea
                id="ann-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Announcement body (supports markdown)"
                rows={4}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={type} onValueChange={(v) => { if (v) setType(v) }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Target</Label>
                <Select value={targetRole} onValueChange={(v) => { if (v) setTargetRole(v) }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    <SelectItem value="admin">Admins Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ann-expires">Expires At (optional)</Label>
              <Input
                id="ann-expires"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>

            {/* Preview */}
            {title && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">Preview</Label>
                <div className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 ${previewStyles[type]?.bg} ${previewStyles[type]?.border}`}>
                  <div className={`flex-1 text-sm ${previewStyles[type]?.text}`}>
                    <span className="font-semibold">{title}</span>
                    {body && <span className="ml-2 opacity-80">{body}</span>}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setDialogOpen(false); resetForm() }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingId ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
