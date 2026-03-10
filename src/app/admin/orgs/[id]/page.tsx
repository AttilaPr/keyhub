'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/fetch'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
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
  ArrowLeft,
  Loader2,
  Ban,
  CheckCircle,
  Trash2,
  Users,
  Key,
  ScrollText,
  DollarSign,
  UserMinus,
} from 'lucide-react'

interface OrgMember {
  id: string
  role: string
  joinedAt: string
  user: {
    id: string
    email: string
    name: string | null
    role: string
    suspended: boolean
  }
}

interface OrgDetail {
  id: string
  name: string
  slug: string
  suspended: boolean
  createdAt: string
  members: OrgMember[]
}

interface ProviderKeyInfo {
  id: string
  provider: string
  label: string
  isActive: boolean
  createdAt: string
  user: { id: string; email: string; name: string | null }
}

interface PlatformKeyInfo {
  id: string
  label: string
  keyPrefix: string
  isActive: boolean
  expiresAt: string | null
  createdAt: string
  user: { id: string; email: string; name: string | null }
}

interface OrgStats {
  totalSpend: number
  requestCount: number
  memberCount: number
  providerKeyCount: number
  platformKeyCount: number
}

export default function AdminOrgDetailPage() {
  const params = useParams()
  const router = useRouter()
  const orgId = params.id as string
  const { addToast } = useToast()

  const [org, setOrg] = useState<OrgDetail | null>(null)
  const [providerKeys, setProviderKeys] = useState<ProviderKeyInfo[]>([])
  const [platformKeys, setPlatformKeys] = useState<PlatformKeyInfo[]>([])
  const [stats, setStats] = useState<OrgStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [suspending, setSuspending] = useState(false)
  const [unsuspending, setUnsuspending] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [removingMember, setRemovingMember] = useState<string | null>(null)

  function fetchOrg() {
    setLoading(true)
    fetch(`/api/admin/orgs/${orgId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load organization')
        return res.json()
      })
      .then((data) => {
        setOrg(data.org)
        setProviderKeys(data.providerKeys)
        setPlatformKeys(data.platformKeys)
        setStats(data.stats)
      })
      .catch(() => {
        addToast({ title: 'Failed to load organization', variant: 'destructive' })
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchOrg()
  }, [orgId])

  async function handleSuspend() {
    setSuspending(true)
    try {
      const res = await apiFetch(`/api/admin/orgs/${orgId}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to suspend')
      }
      addToast({ title: 'Organization suspended', variant: 'success' })
      fetchOrg()
    } catch (err: unknown) {
      addToast({ title: err instanceof Error ? err.message : 'Operation failed', variant: 'destructive' })
    } finally {
      setSuspending(false)
    }
  }

  async function handleUnsuspend() {
    setUnsuspending(true)
    try {
      const res = await apiFetch(`/api/admin/orgs/${orgId}/unsuspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error('Failed to unsuspend')
      addToast({ title: 'Organization unsuspended', variant: 'success' })
      fetchOrg()
    } catch {
      addToast({ title: 'Failed to unsuspend organization', variant: 'destructive' })
    } finally {
      setUnsuspending(false)
    }
  }

  async function handleDelete() {
    if (deleteConfirm !== org?.slug) return
    setDeleting(true)
    try {
      const res = await apiFetch(`/api/admin/orgs/${orgId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete organization')
      addToast({ title: 'Organization deleted', variant: 'success' })
      router.push('/admin/orgs')
    } catch {
      addToast({ title: 'Failed to delete organization', variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  async function handleRemoveMember(userId: string) {
    setRemovingMember(userId)
    try {
      const res = await apiFetch(`/api/admin/orgs/${orgId}/members/${userId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to remove member')
      addToast({ title: 'Member removed', variant: 'success' })
      fetchOrg()
    } catch {
      addToast({ title: 'Failed to remove member', variant: 'destructive' })
    } finally {
      setRemovingMember(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!org) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Organization not found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back button + Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/admin/orgs')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{org.name}</h1>
            {org.suspended ? (
              <Badge className="bg-red-500/10 text-red-400">Suspended</Badge>
            ) : (
              <Badge className="bg-primary/10 text-primary">Active</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground font-mono">{org.slug}</p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { title: 'Members', value: stats?.memberCount ?? 0, icon: Users },
          { title: 'Requests', value: stats?.requestCount ?? 0, icon: ScrollText },
          { title: 'Total Spend', value: `$${(stats?.totalSpend ?? 0).toFixed(4)}`, icon: DollarSign },
          { title: 'Provider Keys', value: stats?.providerKeyCount ?? 0, icon: Key },
          { title: 'Platform Keys', value: stats?.platformKeyCount ?? 0, icon: Key },
        ].map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Members table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Members</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Org Role</TableHead>
                <TableHead>System Role</TableHead>
                <TableHead>User Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {org.members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-4">
                    No members
                  </TableCell>
                </TableRow>
              ) : (
                org.members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {member.user.name || 'Unnamed'}
                        </p>
                        <p className="text-xs text-muted-foreground">{member.user.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={
                        member.role === 'OWNER'
                          ? 'bg-amber-500/10 text-amber-400'
                          : member.role === 'ADMIN'
                            ? 'bg-blue-500/10 text-blue-400'
                            : 'bg-card text-muted-foreground'
                      }>
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={
                        member.user.role === 'SUPER_ADMIN'
                          ? 'bg-red-500/10 text-red-400'
                          : 'bg-card text-muted-foreground'
                      }>
                        {member.user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {member.user.suspended ? (
                        <Badge className="bg-red-500/10 text-red-400">Suspended</Badge>
                      ) : (
                        <Badge className="bg-primary/10 text-primary">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(member.joinedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label="Remove member"
                              disabled={removingMember === member.user.id}
                            >
                              {removingMember === member.user.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <UserMinus className="h-4 w-4 text-red-400" />
                              )}
                            </Button>
                          }
                        />
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove member?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Remove {member.user.email} from {org.name}? They can be re-invited later.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <Button
                              variant="destructive"
                              onClick={() => handleRemoveMember(member.user.id)}
                              disabled={removingMember === member.user.id}
                            >
                              {removingMember === member.user.id && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              )}
                              Remove
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

      {/* Keys tables */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Provider Keys */}
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">Provider Keys</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {providerKeys.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                      No provider keys
                    </TableCell>
                  </TableRow>
                ) : (
                  providerKeys.map((key) => (
                    <TableRow key={key.id}>
                      <TableCell className="text-muted-foreground capitalize text-sm">{key.provider}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{key.label}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{key.user.email}</TableCell>
                      <TableCell>
                        {key.isActive ? (
                          <Badge className="bg-primary/10 text-primary">Active</Badge>
                        ) : (
                          <Badge className="bg-card text-muted-foreground">Disabled</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Platform Keys */}
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">Platform Keys</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Prefix</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {platformKeys.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                      No platform keys
                    </TableCell>
                  </TableRow>
                ) : (
                  platformKeys.map((key) => (
                    <TableRow key={key.id}>
                      <TableCell className="text-muted-foreground text-sm">{key.label}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">{key.keyPrefix}...</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{key.user.email}</TableCell>
                      <TableCell>
                        {key.isActive ? (
                          <Badge className="bg-primary/10 text-primary">Active</Badge>
                        ) : (
                          <Badge className="bg-card text-muted-foreground">Disabled</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Danger Zone */}
      <Card className="border-red-900/50">
        <CardHeader>
          <CardTitle className="text-red-400">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Suspend / Unsuspend */}
          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground/80">
                {org.suspended ? 'Unsuspend organization' : 'Suspend organization'}
              </p>
              <p className="text-xs text-muted-foreground">
                {org.suspended
                  ? 'Re-activate this organization and restore access for all members.'
                  : 'Suspend this organization. All member API calls will be blocked.'}
              </p>
            </div>
            {org.suspended ? (
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button variant="outline" size="sm">
                      <CheckCircle className="h-4 w-4 mr-1.5" />
                      Unsuspend
                    </Button>
                  }
                />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Unsuspend organization?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will re-activate {org.name} and restore access for all members.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <Button onClick={handleUnsuspend} disabled={unsuspending}>
                      {unsuspending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Unsuspend
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button variant="destructive" size="sm">
                      <Ban className="h-4 w-4 mr-1.5" />
                      Suspend
                    </Button>
                  }
                />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Suspend organization?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Suspending {org.name} will block all API calls from all members.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <Button variant="destructive" onClick={handleSuspend} disabled={suspending}>
                      {suspending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Suspend
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          {/* Delete org */}
          <div className="flex items-center justify-between rounded-lg border border-red-900/50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-red-400">Delete organization</p>
              <p className="text-xs text-muted-foreground">
                Permanently delete this organization and all its data. This cannot be undone.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-1.5" />
                    Delete
                  </Button>
                }
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete organization?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete {org.name} and remove all members. Type the
                    organization slug <span className="font-mono text-foreground/80">{org.slug}</span> to confirm.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="px-0 py-2">
                  <Input
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder={org.slug}
                    className="font-mono"
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setDeleteConfirm('')}>Cancel</AlertDialogCancel>
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={deleting || deleteConfirm !== org.slug}
                  >
                    {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Delete Organization
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
