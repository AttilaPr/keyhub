'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Building2 } from 'lucide-react'
import { PlusIcon } from '@/components/ui/plus'
import { UsersIcon } from '@/components/ui/users'
import { LoaderPinwheelIcon } from '@/components/ui/loader-pinwheel'
import { ChevronRightIcon } from '@/components/ui/chevron-right'
import { useAnimatedIcon } from '@/hooks/use-animated-icon'

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
  const { addToast } = useToast()
  const [orgs, setOrgs] = useState<Org[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [orgName, setOrgName] = useState('')
  const [creating, setCreating] = useState(false)

  async function fetchOrgs() {
    try {
      const res = await fetch('/api/orgs')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setOrgs(data)
    } catch {
      addToast({ title: 'Error', description: 'Failed to load organizations', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrgs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!orgName.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: orgName.trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        addToast({ title: 'Error', description: data.error || 'Failed to create organization', variant: 'destructive' })
        return
      }
      const newOrg = await res.json()
      setOrgs((prev) => [newOrg, ...prev])
      setOrgName('')
      setCreateOpen(false)
      addToast({ title: 'Organization created', variant: 'success' })
    } catch {
      addToast({ title: 'Network error', description: 'Could not reach server', variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

  function roleBadge(role: string) {
    if (role === 'OWNER') return <Badge className="bg-primary/10 text-primary">Owner</Badge>
    if (role === 'ADMIN') return <Badge variant="secondary">Admin</Badge>
    return <Badge variant="outline">Member</Badge>
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Organizations</h1>
          <p className="text-muted-foreground">Manage your team workspaces</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <PlusIcon size={16} className="mr-2" />
          New Organization
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoaderPinwheelIcon size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : orgs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center mb-4">
              You are not a member of any organization yet.
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <PlusIcon size={16} className="mr-2" />
              Create your first organization
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {orgs.map((org) => (
            <Link key={org.id} href={`/settings/organizations/${org.id}`}>
              <Card className="hover:border-border transition-colors cursor-pointer">
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">{org.name}</h3>
                        {roleBadge(org.role)}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                        <span className="font-mono text-xs">{org.slug}</span>
                        <span className="flex items-center gap-1">
                          <UsersIcon size={14} />
                          {org.memberCount} {org.memberCount === 1 ? 'member' : 'members'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronRightIcon size={20} className="text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Organization</DialogTitle>
            <DialogDescription>
              Create a new workspace for your team. You will be assigned as the owner.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                placeholder="My Team"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
                maxLength={100}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">A URL-friendly slug will be generated automatically.</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating || !orgName.trim()}>
                {creating && <LoaderPinwheelIcon size={16} className="mr-2 animate-spin" />}
                Create
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
