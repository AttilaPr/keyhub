'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  ArrowLeft,
  Loader2,
  Ban,
  CheckCircle,
  LogOut,
  Key,
  Users,
  ScrollText,
  DollarSign,
  Eye,
  KeyRound,
} from 'lucide-react'

interface UserDetail {
  id: string
  email: string
  name: string | null
  role: string
  suspended: boolean
  suspendedAt: string | null
  suspendReason: string | null
  sessionInvalidatedAt: string | null
  createdAt: string
  providerKeys: {
    id: string
    provider: string
    label: string
    isActive: boolean
    createdAt: string
  }[]
  platformKeys: {
    id: string
    label: string
    keyPrefix: string
    isActive: boolean
    expiresAt: string | null
    createdAt: string
  }[]
  orgMemberships: {
    id: string
    role: string
    joinedAt: string
    organization: { id: string; name: string; slug: string }
  }[]
}

interface UserStats {
  requestCount: number
  totalCost: number
  providerKeyCount: number
  platformKeyCount: number
  orgCount: number
}

interface LogEntry {
  id: string
  provider: string
  model: string
  costUsd: number
  status: string
  latencyMs: number
  createdAt: string
}

export default function AdminUserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.id as string
  const { addToast } = useToast()

  const [user, setUser] = useState<UserDetail | null>(null)
  const [stats, setStats] = useState<UserStats | null>(null)
  const [recentLogs, setRecentLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [suspending, setSuspending] = useState(false)
  const [unsuspending, setUnsuspending] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [resettingPassword, setResettingPassword] = useState(false)
  const [impersonating, setImpersonating] = useState(false)
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false)
  const [suspendReason, setSuspendReason] = useState('')

  function fetchUser() {
    setLoading(true)
    fetch(`/api/admin/users/${userId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load user')
        return res.json()
      })
      .then((data) => {
        setUser(data.user)
        setStats(data.stats)
        setRecentLogs(data.recentLogs)
      })
      .catch(() => {
        addToast({ title: 'Failed to load user details', variant: 'destructive' })
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchUser()
  }, [userId])

  async function handleSuspend() {
    if (!suspendReason.trim()) {
      addToast({ title: 'Please provide a reason for suspension', variant: 'destructive' })
      return
    }
    setSuspending(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: suspendReason.trim() }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to suspend user')
      }
      addToast({ title: 'User suspended', variant: 'success' })
      setSuspendDialogOpen(false)
      setSuspendReason('')
      fetchUser()
    } catch (err: any) {
      addToast({ title: err.message, variant: 'destructive' })
    } finally {
      setSuspending(false)
    }
  }

  async function handleUnsuspend() {
    setUnsuspending(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}/unsuspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error('Failed to unsuspend user')
      addToast({ title: 'User unsuspended', variant: 'success' })
      fetchUser()
    } catch {
      addToast({ title: 'Failed to unsuspend user', variant: 'destructive' })
    } finally {
      setUnsuspending(false)
    }
  }

  async function handleForceLogout() {
    setLoggingOut(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}/force-logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error('Failed to force logout')
      addToast({ title: 'Sessions invalidated', variant: 'success' })
      fetchUser()
    } catch {
      addToast({ title: 'Failed to force logout', variant: 'destructive' })
    } finally {
      setLoggingOut(false)
    }
  }

  async function handleResetPassword() {
    setResettingPassword(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to reset password')
      }
      const data = await res.json()
      addToast({ title: data.message || 'Password reset email sent', variant: 'success' })
    } catch (err: any) {
      addToast({ title: err.message, variant: 'destructive' })
    } finally {
      setResettingPassword(false)
    }
  }

  async function handleImpersonate() {
    setImpersonating(true)
    try {
      const res = await fetch(`/api/admin/impersonate/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to start impersonation')
      }
      addToast({ title: `Now viewing as ${user?.email}`, variant: 'success' })
      // Redirect to dashboard as the impersonated user
      window.location.href = '/dashboard'
    } catch (err: any) {
      addToast({ title: err.message, variant: 'destructive' })
    } finally {
      setImpersonating(false)
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

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">User not found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back button + Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/admin/users')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{user.name || 'Unnamed User'}</h1>
            <Badge className={
              user.role === 'SUPER_ADMIN'
                ? 'bg-red-500/10 text-red-400'
                : 'bg-card text-muted-foreground'
            }>
              {user.role}
            </Badge>
            {user.suspended ? (
              <Badge className="bg-red-500/10 text-red-400">Suspended</Badge>
            ) : (
              <Badge className="bg-primary/10 text-primary">Active</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          {user.suspended && user.suspendReason && (
            <p className="text-xs text-red-400 mt-1">
              Reason: {user.suspendReason}
              {user.suspendedAt && (
                <> &middot; Suspended {new Date(user.suspendedAt).toLocaleDateString()}</>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        {user.suspended ? (
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
                <AlertDialogTitle>Unsuspend user?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will re-activate {user.email} and allow them to use the platform again.
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
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setSuspendDialogOpen(true)}
          >
            <Ban className="h-4 w-4 mr-1.5" />
            Suspend
          </Button>
        )}

        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button variant="outline" size="sm">
                <LogOut className="h-4 w-4 mr-1.5" />
                Force Logout
              </Button>
            }
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Force logout?</AlertDialogTitle>
              <AlertDialogDescription>
                This will invalidate all active sessions for {user.email}. They will need to log in again.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button onClick={handleForceLogout} disabled={loggingOut}>
                {loggingOut && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Force Logout
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button variant="outline" size="sm">
                <KeyRound className="h-4 w-4 mr-1.5" />
                Reset Password
              </Button>
            }
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset password?</AlertDialogTitle>
              <AlertDialogDescription>
                This will generate a temporary password and send it to {user.email}. Their existing sessions will be invalidated.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button onClick={handleResetPassword} disabled={resettingPassword}>
                {resettingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reset Password
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {!user.suspended && (
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button variant="outline" size="sm">
                  <Eye className="h-4 w-4 mr-1.5" />
                  Impersonate
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Impersonate user?</AlertDialogTitle>
                <AlertDialogDescription>
                  You will be redirected to the dashboard and see the app as {user.email}. The impersonation session
                  expires after 15 minutes. All actions are audit-logged.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <Button onClick={handleImpersonate} disabled={impersonating}>
                  {impersonating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Start Impersonation
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Suspend dialog */}
      <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend User</DialogTitle>
            <DialogDescription>
              Suspending {user.email} will immediately block their access to the platform.
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
              <Button variant="outline" onClick={() => setSuspendDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleSuspend}
                disabled={suspending || !suspendReason.trim()}
              >
                {suspending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Suspend User
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            title: 'Total Requests',
            value: stats?.requestCount ?? 0,
            icon: ScrollText,
          },
          {
            title: 'Total Cost',
            value: `$${(stats?.totalCost ?? 0).toFixed(4)}`,
            icon: DollarSign,
          },
          {
            title: 'Active Keys',
            value: (stats?.providerKeyCount ?? 0) + (stats?.platformKeyCount ?? 0),
            sub: `${stats?.providerKeyCount ?? 0} provider + ${stats?.platformKeyCount ?? 0} platform`,
            icon: Key,
          },
          {
            title: 'Organizations',
            value: stats?.orgCount ?? 0,
            icon: Users,
          },
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
              {card.sub && <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

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
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {user.providerKeys.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                      No provider keys
                    </TableCell>
                  </TableRow>
                ) : (
                  user.providerKeys.map((key) => (
                    <TableRow key={key.id}>
                      <TableCell className="text-muted-foreground capitalize text-sm">{key.provider}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{key.label}</TableCell>
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
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {user.platformKeys.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                      No platform keys
                    </TableCell>
                  </TableRow>
                ) : (
                  user.platformKeys.map((key) => (
                    <TableRow key={key.id}>
                      <TableCell className="text-muted-foreground text-sm">{key.label}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">{key.keyPrefix}...</TableCell>
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

      {/* Organization Memberships */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Organization Memberships</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {user.orgMemberships.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                    No organization memberships
                  </TableCell>
                </TableRow>
              ) : (
                user.orgMemberships.map((m) => (
                  <TableRow
                    key={m.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/admin/orgs/${m.organization.id}`)}
                  >
                    <TableCell className="text-foreground/80 text-sm font-medium">
                      {m.organization.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{m.organization.slug}</TableCell>
                    <TableCell>
                      <Badge className={
                        m.role === 'OWNER'
                          ? 'bg-amber-500/10 text-amber-400'
                          : m.role === 'ADMIN'
                            ? 'bg-blue-500/10 text-blue-400'
                            : 'bg-card text-muted-foreground'
                      }>
                        {m.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(m.joinedAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Recent Logs (Last 20)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Latency</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-4">
                    No logs yet
                  </TableCell>
                </TableRow>
              ) : (
                recentLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-muted-foreground capitalize text-sm">{log.provider}</TableCell>
                    <TableCell className="text-muted-foreground text-sm font-mono">{log.model}</TableCell>
                    <TableCell>
                      <Badge className={
                        log.status === 'success'
                          ? 'bg-primary/10 text-primary'
                          : 'bg-red-500/10 text-red-400'
                      }>
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm font-mono">
                      ${log.costUsd.toFixed(6)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      {log.latencyMs}ms
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
