'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
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
import { SearchIcon } from '@/components/ui/search'
import { DeleteIcon } from '@/components/ui/delete'
import { BadgeAlertIcon } from '@/components/ui/badge-alert'
import { ShieldCheckIcon } from '@/components/ui/shield-check'
import { LoaderPinwheelIcon } from '@/components/ui/loader-pinwheel'
import { ChevronLeftIcon } from '@/components/ui/chevron-left'
import { ChevronRightIcon } from '@/components/ui/chevron-right'
import { BanIcon } from '@/components/ui/ban'
import { CircleCheckIcon } from '@/components/ui/circle-check'

interface User {
  id: string
  email: string
  name: string | null
  role: string
  suspended: boolean
  suspendedAt: string | null
  suspendReason: string | null
  createdAt: string
  _count: { logs: number; providerKeys: number; platformKeys: number }
}

export default function AdminUsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)
  const [suspendDialogUser, setSuspendDialogUser] = useState<User | null>(null)
  const [suspendReason, setSuspendReason] = useState('')
  const [suspending, setSuspending] = useState(false)
  const [unsuspending, setUnsuspending] = useState<string | null>(null)
  const { addToast } = useToast()

  function fetchUsers() {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (search) params.set('search', search)
    fetch(`/api/admin/users?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load users')
        return res.json()
      })
      .then((data) => {
        setUsers(data.users)
        setTotal(data.total)
      })
      .catch(() => {
        addToast({ title: 'Failed to load users', variant: 'destructive' })
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchUsers() }, [page])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    fetchUsers()
  }

  async function handleToggleRole(userId: string, currentRole: string) {
    setToggling(userId)
    try {
      const newRole = currentRole === 'SUPER_ADMIN' ? 'USER' : 'SUPER_ADMIN'
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, role: newRole }),
      })
      if (!res.ok) throw new Error('Failed to update role')
      fetchUsers()
      addToast({ title: `Role updated to ${newRole}`, variant: 'success' })
    } catch {
      addToast({ title: 'Failed to update role', variant: 'destructive' })
    } finally {
      setToggling(null)
    }
  }

  async function handleDelete(userId: string) {
    setDeleting(userId)
    try {
      const res = await fetch(`/api/admin/users?id=${userId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete user')
      fetchUsers()
      addToast({ title: 'User deleted', variant: 'success' })
    } catch {
      addToast({ title: 'Failed to delete user', variant: 'destructive' })
    } finally {
      setDeleting(null)
    }
  }

  async function handleSuspend() {
    if (!suspendDialogUser || !suspendReason.trim()) return
    setSuspending(true)
    try {
      const res = await fetch(`/api/admin/users/${suspendDialogUser.id}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: suspendReason.trim() }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to suspend user')
      }
      addToast({ title: 'User suspended', variant: 'success' })
      setSuspendDialogUser(null)
      setSuspendReason('')
      fetchUsers()
    } catch (err: any) {
      addToast({ title: err.message, variant: 'destructive' })
    } finally {
      setSuspending(false)
    }
  }

  async function handleUnsuspend(userId: string) {
    setUnsuspending(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}/unsuspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error('Failed to unsuspend user')
      addToast({ title: 'User unsuspended', variant: 'success' })
      fetchUsers()
    } catch {
      addToast({ title: 'Failed to unsuspend user', variant: 'destructive' })
    } finally {
      setUnsuspending(null)
    }
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground">{total} total users</p>
        </div>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email, name, or ID..."
            className="pl-10"
          />
        </div>
        <Button type="submit" variant="outline">Search</Button>
      </form>

      {/* Suspend Dialog */}
      <Dialog
        open={!!suspendDialogUser}
        onOpenChange={(open) => {
          if (!open) {
            setSuspendDialogUser(null)
            setSuspendReason('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend User</DialogTitle>
            <DialogDescription>
              Suspending {suspendDialogUser?.email} will immediately block their access to the platform.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Reason for suspension</Label>
              <Textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Provide a justification for suspending this user..."
                className="mt-1.5"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSuspendDialogUser(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleSuspend}
                disabled={suspending || !suspendReason.trim()}
              >
                {suspending && <LoaderPinwheelIcon size={16} className="mr-2 animate-spin" />}
                Suspend User
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Requests</TableHead>
                <TableHead className="text-right">Keys</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow
                    key={user.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/admin/users/${user.id}`)}
                  >
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium text-foreground">{user.name || 'Unnamed'}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={
                        user.role === 'SUPER_ADMIN'
                          ? 'bg-red-500/10 text-red-400'
                          : 'bg-card text-muted-foreground'
                      }>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.suspended ? (
                        <Badge className="bg-red-500/10 text-red-400">Suspended</Badge>
                      ) : (
                        <Badge className="bg-primary/10 text-primary">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      {user._count.logs.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      {user._count.providerKeys + user._count.platformKeys}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {/* Suspend / Unsuspend toggle */}
                        {user.suspended ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUnsuspend(user.id)}
                            disabled={unsuspending === user.id}
                            aria-label="Unsuspend user"
                          >
                            {unsuspending === user.id ? (
                              <LoaderPinwheelIcon size={16} className="animate-spin" />
                            ) : (
                              <CircleCheckIcon size={16} className="text-primary" />
                            )}
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSuspendDialogUser(user)}
                            aria-label="Suspend user"
                          >
                            <BanIcon size={16} className="text-muted-foreground" />
                          </Button>
                        )}

                        {/* Toggle role */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleRole(user.id, user.role)}
                          disabled={toggling === user.id}
                          aria-label={user.role === 'SUPER_ADMIN' ? 'Demote to user' : 'Promote to admin'}
                        >
                          {toggling === user.id ? (
                            <LoaderPinwheelIcon size={16} className="animate-spin" />
                          ) : user.role === 'SUPER_ADMIN' ? (
                            <ShieldCheckIcon size={16} className="text-muted-foreground" />
                          ) : (
                            <BadgeAlertIcon size={16} className="text-muted-foreground" />
                          )}
                        </Button>

                        {/* Delete */}
                        <AlertDialog>
                          <AlertDialogTrigger
                            render={
                              <Button variant="ghost" size="sm" aria-label="Delete user">
                                <DeleteIcon size={16} className="text-red-400" />
                              </Button>
                            }
                          />
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete user?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete {user.email} and all their data.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <Button
                                variant="destructive"
                                onClick={() => handleDelete(user.id)}
                                disabled={deleting === user.id}
                              >
                                {deleting === user.id && <LoaderPinwheelIcon size={16} className="mr-2 animate-spin" />}
                                Delete
                              </Button>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeftIcon size={16} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRightIcon size={16} />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
