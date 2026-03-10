'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/fetch'
import { useParams, useRouter } from 'next/navigation'
import { useOrgs } from '@/contexts/orgs-context'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Building2,
  Loader2,
  UserMinus,
  Mail,
  Trash2,
  Copy,
  Shield,
  Crown,
  User as UserIcon,
  ArrowLeft,
  X,
} from 'lucide-react'
import Link from 'next/link'

interface OrgDetail {
  id: string
  name: string
  slug: string
  role: string
  memberCount: number
  createdAt: string
}

interface Member {
  id: string
  userId: string
  email: string
  name: string | null
  role: string
  joinedAt: string
}

interface Invite {
  id: string
  email: string
  role: string
  token: string
  expiresAt: string
}

export default function OrgSettingsPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { addToast } = useToast()
  const { refreshOrgs: refreshSidebarOrgs } = useOrgs()

  const [org, setOrg] = useState<OrgDetail | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)

  // Rename form
  const [editName, setEditName] = useState('')
  const [editSlug, setEditSlug] = useState('')
  const [savingRename, setSavingRename] = useState(false)

  // Invite form
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('MEMBER')
  const [inviting, setInviting] = useState(false)

  // Delete org
  const [deleteSlug, setDeleteSlug] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Remove member
  const [removingMember, setRemovingMember] = useState<string | null>(null)
  const [removeDialogUserId, setRemoveDialogUserId] = useState<string | null>(null)

  // Role change
  const [changingRole, setChangingRole] = useState<string | null>(null)

  // Revoke invite
  const [revokingInvite, setRevokingInvite] = useState<string | null>(null)

  const myRole = org?.role || 'MEMBER'
  const isOwner = myRole === 'OWNER'
  const isAdmin = isOwner || myRole === 'ADMIN'

  const fetchOrg = useCallback(async () => {
    try {
      const res = await fetch('/api/orgs')
      if (!res.ok) throw new Error('Failed to fetch')
      const orgs = await res.json()
      const found = orgs.find((o: OrgDetail) => o.id === id)
      if (!found) {
        addToast({ title: 'Organization not found', variant: 'destructive' })
        router.push('/settings/organizations')
        return
      }
      setOrg(found)
      setEditName(found.name)
      setEditSlug(found.slug)
    } catch {
      addToast({ title: 'Error', description: 'Failed to load organization', variant: 'destructive' })
    }
  }, [id, addToast, router])

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch(`/api/orgs/${id}/members`)
      if (!res.ok) throw new Error('Failed to fetch')
      setMembers(await res.json())
    } catch {
      addToast({ title: 'Error', description: 'Failed to load members', variant: 'destructive' })
    }
  }, [id, addToast])

  const fetchInvites = useCallback(async () => {
    try {
      const res = await fetch(`/api/orgs/${id}/invites`)
      if (!res.ok) {
        if (res.status === 403) return
        throw new Error('Failed to fetch')
      }
      setInvites(await res.json())
    } catch {
      // Silently fail for invite loading
    }
  }, [id])

  useEffect(() => {
    async function load() {
      await Promise.all([fetchOrg(), fetchMembers(), fetchInvites()])
      setLoading(false)
    }
    load()
  }, [fetchOrg, fetchMembers, fetchInvites])

  async function handleRename(e: React.FormEvent) {
    e.preventDefault()
    if (!editName.trim()) return
    setSavingRename(true)
    try {
      const body: Record<string, string> = {}
      if (editName.trim() !== org?.name) body.name = editName.trim()
      if (editSlug.trim() !== org?.slug) body.slug = editSlug.trim()
      if (Object.keys(body).length === 0) {
        addToast({ title: 'No changes to save', variant: 'default' })
        setSavingRename(false)
        return
      }
      const res = await apiFetch(`/api/orgs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        addToast({ title: 'Error', description: data.error || 'Failed to update', variant: 'destructive' })
        return
      }
      const updated = await res.json()
      setOrg((prev) => prev ? { ...prev, name: updated.name, slug: updated.slug } : prev)
      setEditName(updated.name)
      setEditSlug(updated.slug)
      addToast({ title: 'Organization updated', variant: 'success' })
    } catch {
      addToast({ title: 'Network error', description: 'Could not reach server', variant: 'destructive' })
    } finally {
      setSavingRename(false)
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    setChangingRole(userId)
    try {
      const res = await apiFetch(`/api/orgs/${id}/members/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        addToast({ title: 'Error', description: data.error || 'Failed to change role', variant: 'destructive' })
        return
      }
      setMembers((prev) =>
        prev.map((m) => (m.userId === userId ? { ...m, role: newRole } : m))
      )
      addToast({ title: 'Role updated', variant: 'success' })
    } catch {
      addToast({ title: 'Network error', variant: 'destructive' })
    } finally {
      setChangingRole(null)
    }
  }

  async function handleRemoveMember(userId: string) {
    setRemovingMember(userId)
    try {
      const res = await apiFetch(`/api/orgs/${id}/members/${userId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        addToast({ title: 'Error', description: data.error || 'Failed to remove member', variant: 'destructive' })
        return
      }
      setMembers((prev) => prev.filter((m) => m.userId !== userId))
      setRemoveDialogUserId(null)
      addToast({ title: 'Member removed', variant: 'success' })
    } catch {
      addToast({ title: 'Network error', variant: 'destructive' })
    } finally {
      setRemovingMember(null)
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)
    try {
      const res = await apiFetch(`/api/orgs/${id}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        addToast({ title: 'Error', description: data.error || 'Failed to send invite', variant: 'destructive' })
        return
      }
      const inv = await res.json()
      setInvites((prev) => [...prev, inv])
      setInviteEmail('')
      setInviteRole('MEMBER')
      setInviteOpen(false)
      addToast({ title: 'Invite sent', description: `Invited ${inv.email}`, variant: 'success' })
    } catch {
      addToast({ title: 'Network error', variant: 'destructive' })
    } finally {
      setInviting(false)
    }
  }

  async function handleRevokeInvite(inviteId: string) {
    setRevokingInvite(inviteId)
    try {
      const res = await apiFetch(`/api/orgs/${id}/invites`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        addToast({ title: 'Error', description: data.error || 'Failed to revoke invite', variant: 'destructive' })
        return
      }
      setInvites((prev) => prev.filter((inv) => inv.id !== inviteId))
      addToast({ title: 'Invite revoked', variant: 'success' })
    } catch {
      addToast({ title: 'Network error', variant: 'destructive' })
    } finally {
      setRevokingInvite(null)
    }
  }

  async function handleDeleteOrg() {
    if (deleteSlug !== org?.slug) {
      addToast({ title: 'Slug does not match', description: 'Type the organization slug to confirm deletion.', variant: 'destructive' })
      return
    }
    setDeleting(true)
    try {
      const res = await apiFetch(`/api/orgs/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        addToast({ title: 'Error', description: data.error || 'Failed to delete', variant: 'destructive' })
        setDeleting(false)
        return
      }
      addToast({ title: 'Organization deleted', variant: 'success' })
      refreshSidebarOrgs()
      router.push('/settings/organizations')
    } catch {
      addToast({ title: 'Network error', variant: 'destructive' })
      setDeleting(false)
    }
  }

  async function copyInviteLink(token: string) {
    const url = `${window.location.origin}/invite/${token}`
    try {
      await navigator.clipboard.writeText(url)
      addToast({ title: 'Invite link copied', variant: 'success' })
    } catch {
      addToast({ title: 'Failed to copy', description: 'Could not access clipboard', variant: 'destructive' })
    }
  }

  function roleIcon(role: string) {
    if (role === 'OWNER') return <Crown className="h-3.5 w-3.5" />
    if (role === 'ADMIN') return <Shield className="h-3.5 w-3.5" />
    return <UserIcon className="h-3.5 w-3.5" />
  }

  function roleBadge(role: string) {
    if (role === 'OWNER') return <Badge className="bg-primary/10 text-primary">{roleIcon(role)} Owner</Badge>
    if (role === 'ADMIN') return <Badge variant="secondary">{roleIcon(role)} Admin</Badge>
    return <Badge variant="outline">{roleIcon(role)} Member</Badge>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!org) return null

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Link href="/settings/organizations">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{org.name}</h1>
          <p className="text-muted-foreground text-sm font-mono">{org.slug}</p>
        </div>
        <div className="ml-2">{roleBadge(org.role)}</div>
      </div>

      {/* Rename Org */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-foreground">Organization Details</CardTitle>
                <CardDescription>Update the organization name and slug</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRename} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Name</Label>
                  <Input
                    id="edit-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-slug">Slug</Label>
                  <Input
                    id="edit-slug"
                    value={editSlug}
                    onChange={(e) => setEditSlug(e.target.value)}
                    required
                    maxLength={48}
                    className="font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={
                    savingRename ||
                    (editName.trim() === org.name && editSlug.trim() === org.slug)
                  }
                >
                  {savingRename && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Members */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UserIcon className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-foreground">Members</CardTitle>
                <CardDescription>{members.length} {members.length === 1 ? 'member' : 'members'}</CardDescription>
              </div>
            </div>
            {isAdmin && (
              <Button onClick={() => setInviteOpen(true)} size="sm">
                <Mail className="mr-2 h-4 w-4" />
                Invite
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                {isAdmin && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.userId}>
                  <TableCell>
                    <div>
                      <div className="font-medium text-foreground">{member.name || 'Unnamed'}</div>
                      <div className="text-sm text-muted-foreground">{member.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {isOwner && member.role !== 'OWNER' ? (
                      <Select
                        value={member.role}
                        onValueChange={(value) => {
                          if (value) handleRoleChange(member.userId, value)
                        }}
                        disabled={changingRole === member.userId}
                      >
                        <SelectTrigger className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                          <SelectItem value="MEMBER">Member</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      roleBadge(member.role)
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(member.joinedAt).toLocaleDateString()}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      {member.role !== 'OWNER' && (
                        <AlertDialog
                          open={removeDialogUserId === member.userId}
                          onOpenChange={(open) => {
                            if (!open) setRemoveDialogUserId(null)
                          }}
                        >
                          <AlertDialogTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => setRemoveDialogUserId(member.userId)}
                              />
                            }
                          >
                            <UserMinus className="h-4 w-4 text-red-400" />
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove member?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Remove <strong>{member.name || member.email}</strong> from this organization?
                                They will lose access to all shared resources.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <Button
                                variant="destructive"
                                disabled={removingMember === member.userId}
                                onClick={() => handleRemoveMember(member.userId)}
                              >
                                {removingMember === member.userId && (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Remove
                              </Button>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pending Invites */}
      {isAdmin && invites.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-foreground">Pending Invites</CardTitle>
                <CardDescription>{invites.length} pending {invites.length === 1 ? 'invite' : 'invites'}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell className="text-foreground">{invite.email}</TableCell>
                    <TableCell>{roleBadge(invite.role)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(invite.expiresAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => copyInviteLink(invite.token)}
                          title="Copy invite link"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleRevokeInvite(invite.id)}
                          disabled={revokingInvite === invite.id}
                          title="Revoke invite"
                        >
                          {revokingInvite === invite.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <X className="h-3.5 w-3.5 text-red-400" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Member</DialogTitle>
            <DialogDescription>
              Send an invite to join <strong>{org.name}</strong>. The invite link expires in 7 days.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email Address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select
                value={inviteRole}
                onValueChange={(value) => {
                  if (value) setInviteRole(value)
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MEMBER">Member</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Members can view resources. Admins can also manage keys and invite members.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={inviting || !inviteEmail.trim()}>
                {inviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Invite
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Danger Zone */}
      {isOwner && (
        <>
          <Separator />
          <Card className="border-red-900/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Trash2 className="h-5 w-5 text-red-400" />
                <div>
                  <CardTitle className="text-red-400">Danger Zone</CardTitle>
                  <CardDescription>Irreversible actions on this organization</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground font-medium">Delete organization</p>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete this organization and all associated data.
                    This action cannot be undone.
                  </p>
                </div>
                <AlertDialog
                  open={deleteDialogOpen}
                  onOpenChange={(open) => {
                    setDeleteDialogOpen(open)
                    if (!open) {
                      setDeleteSlug('')
                      setDeleting(false)
                    }
                  }}
                >
                  <AlertDialogTrigger render={<Button variant="destructive" />}>
                    Delete Organization
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete organization?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete <strong>{org.name}</strong> and all associated data
                        including members, invites, and shared resources. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="px-0 py-2">
                      <Label htmlFor="delete-slug" className="text-sm text-muted-foreground">
                        Type <span className="font-mono text-foreground/80">{org.slug}</span> to confirm
                      </Label>
                      <Input
                        id="delete-slug"
                        placeholder={org.slug}
                        value={deleteSlug}
                        onChange={(e) => setDeleteSlug(e.target.value)}
                        className="mt-2 font-mono"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && deleteSlug === org.slug) handleDeleteOrg()
                        }}
                      />
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <Button
                        variant="destructive"
                        disabled={deleting || deleteSlug !== org.slug}
                        onClick={handleDeleteOrg}
                      >
                        {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Delete permanently
                      </Button>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
