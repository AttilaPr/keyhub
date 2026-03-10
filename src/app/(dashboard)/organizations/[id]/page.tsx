'use client'

import { useEffect, useState, useCallback } from 'react'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { apiFetch } from '@/lib/fetch'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useOrgs } from '@/contexts/orgs-context'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Building2,
  Users,
  Mail,
  Loader2,
  Trash2,
  Copy,
  Check,
  Settings2,
  UserMinus,
  Link as LinkIcon,
} from 'lucide-react'

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

interface OrgInfo {
  id: string
  name: string
  slug: string
  role: string
  memberCount: number
  createdAt: string
}

export default function OrganizationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const orgId = params.id as string
  const { data: session } = useSession()
  const { addToast } = useToast()
  const { refreshOrgs: refreshSidebarOrgs } = useOrgs()

  const [org, setOrg] = useState<OrgInfo | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [myRole, setMyRole] = useState<string>('MEMBER')

  // Edit org state
  const [editName, setEditName] = useState('')
  const [savingName, setSavingName] = useState(false)

  // Invite state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('MEMBER')
  const [sendingInvite, setSendingInvite] = useState(false)
  const [inviteLinkOpen, setInviteLinkOpen] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const { copy, copied: linkCopied } = useCopyToClipboard()

  // Remove member state
  const [removeMember, setRemoveMember] = useState<Member | null>(null)
  const [removing, setRemoving] = useState(false)

  // Delete org state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deletingOrg, setDeletingOrg] = useState(false)

  const isOwner = myRole === 'OWNER'
  const isAdmin = myRole === 'OWNER' || myRole === 'ADMIN'

  const fetchOrg = useCallback(async () => {
    try {
      const res = await fetch('/api/orgs')
      if (!res.ok) return
      const orgs: OrgInfo[] = await res.json()
      const found = orgs.find((o) => o.id === orgId)
      if (found) {
        setOrg(found)
        setMyRole(found.role)
        setEditName(found.name)
      }
    } catch {
      // ignore
    }
  }, [orgId])

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch(`/api/orgs/${orgId}/members`)
      if (res.ok) {
        const data = await res.json()
        setMembers(data)
      }
    } catch {
      // ignore
    }
  }, [orgId])

  const fetchInvites = useCallback(async () => {
    try {
      const res = await fetch(`/api/orgs/${orgId}/invites`)
      if (res.ok) {
        const data = await res.json()
        setInvites(data)
      }
    } catch {
      // ignore
    }
  }, [orgId])

  useEffect(() => {
    async function loadAll() {
      await Promise.all([fetchOrg(), fetchMembers(), fetchInvites()])
      setLoading(false)
    }
    loadAll()
  }, [fetchOrg, fetchMembers, fetchInvites])

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault()
    if (!editName.trim()) return
    setSavingName(true)
    try {
      const res = await apiFetch(`/api/orgs/${orgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName }),
      })
      if (res.ok) {
        addToast({ title: 'Organization updated', variant: 'success' })
        fetchOrg()
      } else {
        const data = await res.json()
        addToast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch {
      addToast({ title: 'Network error', variant: 'destructive' })
    } finally {
      setSavingName(false)
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setSendingInvite(true)
    try {
      const res = await apiFetch(`/api/orgs/${orgId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })
      if (res.ok) {
        const data = await res.json()
        const link = `${window.location.origin}/organizations/invite/${data.token}`
        setInviteLink(link)
        setInviteLinkOpen(true)
        setInviteEmail('')
        setInviteRole('MEMBER')
        fetchInvites()
        addToast({ title: 'Invite created', variant: 'success' })
      } else {
        const data = await res.json()
        addToast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch {
      addToast({ title: 'Network error', variant: 'destructive' })
    } finally {
      setSendingInvite(false)
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    try {
      const res = await apiFetch(`/api/orgs/${orgId}/members/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (res.ok) {
        addToast({ title: 'Role updated', variant: 'success' })
        fetchMembers()
      } else {
        const data = await res.json()
        addToast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch {
      addToast({ title: 'Network error', variant: 'destructive' })
    }
  }

  async function handleRemoveMember() {
    if (!removeMember) return
    setRemoving(true)
    try {
      const res = await apiFetch(`/api/orgs/${orgId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: removeMember.userId }),
      })
      if (res.ok) {
        addToast({ title: 'Member removed', variant: 'success' })
        setRemoveMember(null)
        fetchMembers()
        fetchOrg()
      } else {
        const data = await res.json()
        addToast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch {
      addToast({ title: 'Network error', variant: 'destructive' })
    } finally {
      setRemoving(false)
    }
  }

  async function handleRevokeInvite(inviteId: string) {
    try {
      const res = await apiFetch(`/api/orgs/${orgId}/invites`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId }),
      })
      if (res.ok) {
        addToast({ title: 'Invite revoked', variant: 'success' })
        fetchInvites()
      } else {
        const data = await res.json()
        addToast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch {
      addToast({ title: 'Network error', variant: 'destructive' })
    }
  }

  async function handleDeleteOrg() {
    setDeletingOrg(true)
    try {
      const res = await apiFetch(`/api/orgs/${orgId}`, { method: 'DELETE' })
      if (res.ok) {
        addToast({ title: 'Organization deleted', variant: 'success' })
        refreshSidebarOrgs()
        router.push('/organizations')
      } else {
        const data = await res.json()
        addToast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch {
      addToast({ title: 'Network error', variant: 'destructive' })
    } finally {
      setDeletingOrg(false)
    }
  }

  async function copyInviteLink() {
    await copy(inviteLink)
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

  if (loading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-8 w-64" />
        <Card>
          <CardContent className="p-6">
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!org) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Organization not found or you are not a member.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{org.name}</h1>
        <p className="text-muted-foreground">Manage organization settings and members</p>
      </div>

      {/* Organization Settings */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Settings2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-foreground">Organization Settings</CardTitle>
                <CardDescription>Update your organization details</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveName} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="org-edit-name">Name</Label>
                  <Input
                    id="org-edit-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input value={org.slug} disabled />
                  <p className="text-xs text-muted-foreground">Auto-generated from the name</p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={savingName || editName.trim() === org.name}>
                  {savingName && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-foreground">Members</CardTitle>
              <CardDescription>{members.length} {members.length === 1 ? 'member' : 'members'}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
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
                <TableRow key={member.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">{member.name || 'Unnamed'}</p>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {isOwner && member.role !== 'OWNER' && member.userId !== session?.user?.id ? (
                      <Select
                        value={member.role}
                        onValueChange={(val) => {
                          if (val) handleRoleChange(member.userId, val)
                        }}
                      >
                        <SelectTrigger className="w-28 h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                          <SelectItem value="MEMBER">Member</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge
                        variant="secondary"
                        className={roleBadgeClass(member.role)}
                      >
                        {member.role}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(member.joinedAt).toLocaleDateString()}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      {member.role !== 'OWNER' && member.userId !== session?.user?.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setRemoveMember(member)}
                          className="text-muted-foreground hover:text-red-400"
                          aria-label={`Remove ${member.name || member.email}`}
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Invite Members */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-foreground">Invite Members</CardTitle>
                <CardDescription>Send an invite link to add new members</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="invite-email">Email Address</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="colleague@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-role">Role</Label>
                  <Select value={inviteRole} onValueChange={(val) => { if (val) setInviteRole(val) }}>
                    <SelectTrigger id="invite-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MEMBER">Member</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={sendingInvite}>
                  {sendingInvite && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send Invite
                </Button>
              </div>
            </form>

            {/* Pending Invites */}
            {invites.length > 0 && (
              <>
                <Separator className="my-6" />
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Pending Invites</h4>
                  <div className="space-y-2">
                    {invites.map((invite) => (
                      <div key={invite.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm text-foreground/80">{invite.email}</p>
                            <p className="text-xs text-muted-foreground">
                              Expires {new Date(invite.expiresAt).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge variant="secondary" className={roleBadgeClass(invite.role)}>
                            {invite.role}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRevokeInvite(invite.id)}
                          className="text-muted-foreground hover:text-red-400"
                          aria-label={`Revoke invite for ${invite.email}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Danger Zone */}
      {isOwner && (
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
                  Permanently delete this organization, all memberships, and pending invites.
                </p>
              </div>
              <Button variant="destructive" onClick={() => setDeleteConfirmOpen(true)}>
                Delete Organization
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invite Link Dialog */}
      <Dialog open={inviteLinkOpen} onOpenChange={setInviteLinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Link Created</DialogTitle>
            <DialogDescription>
              Share this link with the invited person. It expires in 7 days.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              <code className="flex-1 break-all rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                {inviteLink}
              </code>
            </div>
            <div className="flex justify-end gap-3">
              <Button onClick={copyInviteLink} variant="outline">
                {linkCopied ? (
                  <Check className="mr-2 h-4 w-4 text-primary" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}
                {linkCopied ? 'Copied!' : 'Copy Link'}
              </Button>
              <Button onClick={() => setInviteLinkOpen(false)}>Done</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Member AlertDialog */}
      <AlertDialog open={!!removeMember} onOpenChange={(open) => { if (!open) { setRemoveMember(null); setRemoving(false) } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeMember && `Are you sure you want to remove ${removeMember.name || removeMember.email} from this organization? They will lose access immediately.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember} className="bg-red-600 hover:bg-red-700" disabled={removing}>
              {removing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Org AlertDialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={(open) => { if (!open) { setDeleteConfirmOpen(false); setDeletingOrg(false) } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete organization?</AlertDialogTitle>
            <AlertDialogDescription>
              This action is permanent and cannot be undone. All memberships and pending invites will be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteOrg} className="bg-red-600 hover:bg-red-700" disabled={deletingOrg}>
              {deletingOrg && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
