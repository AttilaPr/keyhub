'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { Skeleton } from '@/components/ui/skeleton'
import { Building2 } from 'lucide-react'
import { PlusIcon } from '@/components/ui/plus'
import { UsersIcon } from '@/components/ui/users'
import { LoaderPinwheelIcon } from '@/components/ui/loader-pinwheel'
import { ArrowRightIcon } from '@/components/ui/arrow-right'
import { apiFetch } from '@/lib/fetch'
import { useOrgs } from '@/contexts/orgs-context'

interface Org {
  id: string
  name: string
  slug: string
  role: string
  memberCount: number
  joinedAt: string
  createdAt: string
}

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const { addToast } = useToast()
  const { refreshOrgs: refreshSidebarOrgs } = useOrgs()

  async function fetchOrgs() {
    try {
      const res = await fetch('/api/orgs')
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setOrgs(data)
    } catch {
      addToast({ title: 'Failed to load organizations', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchOrgs() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    try {
      const res = await apiFetch('/api/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      })

      if (res.ok) {
        addToast({ title: 'Organization created', variant: 'success' })
        setCreateOpen(false)
        setNewName('')
        fetchOrgs()
        refreshSidebarOrgs()
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

  function roleBadgeClass(role: string) {
    switch (role) {
      case 'OWNER':
        return 'bg-primary/10 text-primary'
      case 'ADMIN':
        return 'bg-cyan-200/20 dark:bg-cyan-400/10 text-cyan-600 dark:text-cyan-400'
      default:
        return ''
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Organizations</h1>
          <p className="text-muted-foreground">Manage your teams and organizations</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <PlusIcon size={16} className="mr-2" />
          Create Organization
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-40 mb-3" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : orgs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">No organizations yet. Create one to start collaborating.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orgs.map((org) => (
            <Link key={org.id} href={`/organizations/${org.id}`}>
              <Card className="transition-colors hover:border-border cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{org.name}</h3>
                        <p className="text-xs text-muted-foreground">{org.slug}</p>
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      className={roleBadgeClass(org.role)}
                    >
                      {org.role}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <UsersIcon size={14} />
                      {org.memberCount} {org.memberCount === 1 ? 'member' : 'members'}
                    </div>
                    <ArrowRightIcon size={16} className="text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Create Organization Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Organization</DialogTitle>
            <DialogDescription>
              Create a new organization to collaborate with your team.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                placeholder="e.g. Acme Inc."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                maxLength={100}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <LoaderPinwheelIcon size={16} className="mr-2" />}
                Create
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
