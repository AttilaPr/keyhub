'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/fetch'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { FileTextIcon } from '@/components/ui/file-text'
import { LoaderPinwheelIcon } from '@/components/ui/loader-pinwheel'
import { DeleteIcon } from '@/components/ui/delete'
import { SquarePenIcon } from '@/components/ui/square-pen'
import { useAnimatedIcon } from '@/hooks/use-animated-icon'

interface PromptTemplate {
  id: string
  name: string
  description: string | null
  systemPrompt: string
  createdAt: string
  updatedAt: string
  usageCount?: number
}

export default function TemplatesPage() {
  const { iconRef: fileTextIconRef, handlers: fileTextIconHandlers } = useAnimatedIcon()
  const [templates, setTemplates] = useState<PromptTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const { addToast } = useToast()

  async function fetchTemplates() {
    try {
      const res = await fetch('/api/templates')
      if (!res.ok) throw new Error('Failed to load templates')
      const data = await res.json()
      // Support both paginated { templates, total } and legacy array responses
      setTemplates(Array.isArray(data) ? data : data.templates ?? [])
    } catch {
      addToast({ title: 'Failed to load templates', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTemplates() }, [])

  function openCreate() {
    setEditingTemplate(null)
    setName('')
    setDescription('')
    setSystemPrompt('')
    setDialogOpen(true)
  }

  function openEdit(template: PromptTemplate) {
    setEditingTemplate(template)
    setName(template.name)
    setDescription(template.description || '')
    setSystemPrompt(template.systemPrompt)
    setDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    try {
      if (editingTemplate) {
        const res = await apiFetch('/api/templates', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingTemplate.id,
            name,
            description: description || null,
            systemPrompt,
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          addToast({ title: 'Error', description: data.error, variant: 'destructive' })
          return
        }
        addToast({ title: 'Template updated', variant: 'success' })
      } else {
        const res = await apiFetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description: description || null, systemPrompt }),
        })
        if (!res.ok) {
          const data = await res.json()
          addToast({ title: 'Error', description: data.error, variant: 'destructive' })
          return
        }
        addToast({ title: 'Template created', variant: 'success' })
      }

      setDialogOpen(false)
      setEditingTemplate(null)
      fetchTemplates()
    } catch {
      addToast({ title: 'Network error', description: 'Could not reach server', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await apiFetch(`/api/templates?id=${deleteId}`, { method: 'DELETE' })
      if (res.ok) {
        addToast({ title: 'Template deleted', variant: 'default' })
        setDeleteId(null)
        fetchTemplates()
      } else {
        const data = await res.json().catch(() => ({}))
        addToast({ title: 'Failed to delete template', description: data.error || 'Something went wrong', variant: 'destructive' })
      }
    } catch {
      addToast({ title: 'Network error', description: 'Could not reach server', variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Prompt Templates</h1>
          <p className="text-muted-foreground">Reusable system prompts for your API requests</p>
        </div>
        <Button onClick={openCreate}>
          <PlusIcon size={16} className="mr-2" />
          Create Template
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <Card {...fileTextIconHandlers}>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileTextIcon ref={fileTextIconRef} size={48} className="text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">No templates yet. Create one to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className="group relative">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-foreground text-base truncate">{template.name}</CardTitle>
                    {template.description && (
                      <CardDescription className="mt-1 line-clamp-2">{template.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(template)}
                      className="text-muted-foreground hover:text-primary"
                      aria-label={`Edit ${template.name}`}
                    >
                      <SquarePenIcon size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(template.id)}
                      className="text-muted-foreground hover:text-red-400"
                      aria-label={`Delete ${template.name}`}
                    >
                      <DeleteIcon size={16} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <pre className="rounded-lg bg-muted border border-border p-3 text-xs text-muted-foreground whitespace-pre-wrap max-h-32 overflow-y-auto font-mono">
                  {template.systemPrompt.length > 200
                    ? template.systemPrompt.slice(0, 200) + '...'
                    : template.systemPrompt}
                </pre>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-muted-foreground">
                    Updated {new Date(template.updatedAt).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(template.usageCount ?? 0).toLocaleString()} {template.usageCount === 1 ? 'use' : 'uses'}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); setEditingTemplate(null) } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create Template'}</DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? 'Update your prompt template.'
                : 'Create a reusable system prompt template.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tpl-name">Name</Label>
              <Input
                id="tpl-name"
                placeholder="e.g. Code Reviewer"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-desc">Description</Label>
              <Input
                id="tpl-desc"
                placeholder="Optional description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-prompt">System Prompt</Label>
              <textarea
                id="tpl-prompt"
                placeholder="You are a helpful assistant that..."
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                required
                rows={6}
                className="flex w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-lime-400/50 focus:border-lime-400/50 disabled:opacity-50 font-mono resize-y"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); setEditingTemplate(null) }}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <LoaderPinwheelIcon size={16} className="mr-2 animate-spin" />}
                {editingTemplate ? 'Save Changes' : 'Create Template'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) { setDeleteId(null); setDeleting(false) } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The template will be permanently deleted.
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
