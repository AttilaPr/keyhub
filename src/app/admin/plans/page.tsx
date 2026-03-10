'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/fetch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
import {
  Plus,
  Trash2,
  Loader2,
  Sprout,
  Edit2,
  CrownIcon,
  Users,
  Building,
} from 'lucide-react'

interface Plan {
  id: string
  name: string
  monthlyPriceUsd: number
  requestsPerMonth: number
  platformKeysLimit: number
  providerKeysLimit: number
  teamMembersLimit: number
  logsRetentionDays: number
  apiRateLimit: number
  createdAt: string
  _count: {
    users: number
    organizations: number
  }
}

const PLAN_FIELDS = [
  { key: 'monthlyPriceUsd', label: 'Monthly Price ($)', type: 'number', step: '0.01' },
  { key: 'requestsPerMonth', label: 'Requests/Month', type: 'number', step: '1', hint: '0 = unlimited' },
  { key: 'platformKeysLimit', label: 'Platform Keys Limit', type: 'number', step: '1', hint: '0 = unlimited' },
  { key: 'providerKeysLimit', label: 'Provider Keys Limit', type: 'number', step: '1', hint: '0 = unlimited' },
  { key: 'teamMembersLimit', label: 'Team Members Limit', type: 'number', step: '1', hint: '0 = unlimited' },
  { key: 'logsRetentionDays', label: 'Logs Retention (days)', type: 'number', step: '1' },
  { key: 'apiRateLimit', label: 'API Rate Limit (RPM)', type: 'number', step: '1' },
] as const

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [formData, setFormData] = useState<Record<string, string>>({})
  const { addToast } = useToast()

  function fetchPlans() {
    setLoading(true)
    fetch('/api/admin/plans')
      .then((res) => res.json())
      .then((data) => setPlans(data.plans))
      .catch(() => addToast({ title: 'Failed to load plans', variant: 'destructive' }))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchPlans()
  }, [])

  function openCreate() {
    setFormData({
      name: '',
      monthlyPriceUsd: '0',
      requestsPerMonth: '1000',
      platformKeysLimit: '5',
      providerKeysLimit: '4',
      teamMembersLimit: '1',
      logsRetentionDays: '30',
      apiRateLimit: '60',
    })
    setCreateOpen(true)
  }

  function openEdit(plan: Plan) {
    setEditingPlan(plan)
    setFormData({
      name: plan.name,
      monthlyPriceUsd: String(plan.monthlyPriceUsd),
      requestsPerMonth: String(plan.requestsPerMonth),
      platformKeysLimit: String(plan.platformKeysLimit),
      providerKeysLimit: String(plan.providerKeysLimit),
      teamMembersLimit: String(plan.teamMembersLimit),
      logsRetentionDays: String(plan.logsRetentionDays),
      apiRateLimit: String(plan.apiRateLimit),
    })
    setEditOpen(true)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.name?.trim()) return
    setCreating(true)
    try {
      const res = await apiFetch('/api/admin/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          monthlyPriceUsd: parseFloat(formData.monthlyPriceUsd) || 0,
          requestsPerMonth: parseInt(formData.requestsPerMonth) || 0,
          platformKeysLimit: parseInt(formData.platformKeysLimit) || 5,
          providerKeysLimit: parseInt(formData.providerKeysLimit) || 4,
          teamMembersLimit: parseInt(formData.teamMembersLimit) || 1,
          logsRetentionDays: parseInt(formData.logsRetentionDays) || 30,
          apiRateLimit: parseInt(formData.apiRateLimit) || 60,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create plan')
      }
      addToast({ title: 'Plan created', variant: 'success' })
      setCreateOpen(false)
      fetchPlans()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create plan'
      addToast({ title: message, variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingPlan) return
    setSaving(true)
    try {
      const res = await apiFetch(`/api/admin/plans/${editingPlan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name?.trim() || undefined,
          monthlyPriceUsd: parseFloat(formData.monthlyPriceUsd),
          requestsPerMonth: parseInt(formData.requestsPerMonth),
          platformKeysLimit: parseInt(formData.platformKeysLimit),
          providerKeysLimit: parseInt(formData.providerKeysLimit),
          teamMembersLimit: parseInt(formData.teamMembersLimit),
          logsRetentionDays: parseInt(formData.logsRetentionDays),
          apiRateLimit: parseInt(formData.apiRateLimit),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update plan')
      }
      addToast({ title: 'Plan updated', variant: 'success' })
      setEditOpen(false)
      setEditingPlan(null)
      fetchPlans()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update plan'
      addToast({ title: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      const res = await apiFetch(`/api/admin/plans/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete plan')
      }
      addToast({ title: 'Plan deleted', variant: 'success' })
      fetchPlans()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete plan'
      addToast({ title: message, variant: 'destructive' })
    } finally {
      setDeleting(null)
    }
  }

  async function handleSeed() {
    setSeeding(true)
    try {
      const res = await apiFetch('/api/admin/plans/seed', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to seed plans')
      const data = await res.json()
      addToast({
        title: `Seeded ${data.created} plans (${data.skipped} already existed)`,
        variant: 'success',
      })
      fetchPlans()
    } catch {
      addToast({ title: 'Failed to seed default plans', variant: 'destructive' })
    } finally {
      setSeeding(false)
    }
  }

  function formatLimit(value: number): string {
    return value === 0 ? 'Unlimited' : value.toLocaleString()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Plans</h1>
          <p className="text-muted-foreground">Manage subscription plans and quotas</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSeed} disabled={seeding}>
            {seeding ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sprout className="mr-2 h-4 w-4" />
            )}
            Seed Defaults
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New Plan
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-72 w-full" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <CrownIcon className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No plans created yet</p>
            <p className="text-xs text-muted-foreground">
              Create a plan or seed defaults to get started
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => (
            <Card key={plan.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-foreground capitalize">{plan.name}</CardTitle>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => openEdit(plan)}
                    >
                      <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger
                        render={
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <Trash2 className="h-3.5 w-3.5 text-red-400" />
                          </Button>
                        }
                      />
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete plan?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the <strong>{plan.name}</strong> plan.
                            Users and orgs must be reassigned first.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <Button
                            variant="destructive"
                            onClick={() => handleDelete(plan.id)}
                            disabled={deleting === plan.id}
                          >
                            {deleting === plan.id && (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Delete
                          </Button>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <div className="text-2xl font-bold text-primary">
                  {plan.monthlyPriceUsd === 0
                    ? 'Free'
                    : `$${plan.monthlyPriceUsd}/mo`}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Requests/mo</span>
                    <span className="text-muted-foreground">{formatLimit(plan.requestsPerMonth)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Platform keys</span>
                    <span className="text-muted-foreground">{formatLimit(plan.platformKeysLimit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Provider keys</span>
                    <span className="text-muted-foreground">{formatLimit(plan.providerKeysLimit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Team members</span>
                    <span className="text-muted-foreground">{formatLimit(plan.teamMembersLimit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Log retention</span>
                    <span className="text-muted-foreground">{plan.logsRetentionDays}d</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rate limit</span>
                    <span className="text-muted-foreground">{plan.apiRateLimit} RPM</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-border flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {plan._count.users} users
                  </span>
                  <span className="flex items-center gap-1">
                    <Building className="h-3 w-3" />
                    {plan._count.organizations} orgs
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Plan Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Plan</DialogTitle>
            <DialogDescription>
              Define a new subscription plan with limits and quotas.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Plan Name</Label>
              <Input
                value={formData.name ?? ''}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. starter"
                required
              />
            </div>
            {PLAN_FIELDS.map((field) => (
              <div key={field.key} className="space-y-1">
                <Label>{field.label}</Label>
                <Input
                  type={field.type}
                  step={field.step}
                  min="0"
                  value={formData[field.key] ?? ''}
                  onChange={(e) => setFormData((p) => ({ ...p, [field.key]: e.target.value }))}
                />
                {'hint' in field && field.hint && (
                  <p className="text-xs text-muted-foreground">{field.hint}</p>
                )}
              </div>
            ))}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating || !formData.name?.trim()}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Plan
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Plan Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Plan</DialogTitle>
            <DialogDescription>
              Changes apply to all users and orgs on this plan.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label>Plan Name</Label>
              <Input
                value={formData.name ?? ''}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            {PLAN_FIELDS.map((field) => (
              <div key={field.key} className="space-y-1">
                <Label>{field.label}</Label>
                <Input
                  type={field.type}
                  step={field.step}
                  min="0"
                  value={formData[field.key] ?? ''}
                  onChange={(e) => setFormData((p) => ({ ...p, [field.key]: e.target.value }))}
                />
                {'hint' in field && field.hint && (
                  <p className="text-xs text-muted-foreground">{field.hint}</p>
                )}
              </div>
            ))}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
