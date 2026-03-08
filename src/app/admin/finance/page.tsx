'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
  DollarSign,
  TrendingUp,
  Percent,
  Activity,
  Plus,
  Minus,
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

interface PricingEntry {
  model: string
  inputPer1M: number
  outputPer1M: number
}

interface FinanceSummary {
  totalRevenue: number
  providerCost: number
  margin: number
  requestCount: number
}

interface UserRevenue {
  id: string
  email: string
  name: string | null
  pricingMultiplier: number
  requestCount: number
  totalCost: number
}

interface CreditTransaction {
  id: string
  userId: string
  amount: number
  reason: string
  adminId: string
  adminEmail: string
  createdAt: string
  user: { id: string; email: string; name: string | null }
}

export default function AdminFinancePage() {
  // Date range
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const [dateFrom, setDateFrom] = useState(firstOfMonth.toISOString().split('T')[0])
  const [dateTo, setDateTo] = useState(now.toISOString().split('T')[0])

  const [summary, setSummary] = useState<FinanceSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [users, setUsers] = useState<UserRevenue[]>([])
  const [usersPage, setUsersPage] = useState(1)
  const [usersTotalPages, setUsersTotalPages] = useState(1)
  const [usersTotal, setUsersTotal] = useState(0)
  const [usersSearch, setUsersSearch] = useState('')
  const [usersLoading, setUsersLoading] = useState(true)
  const [transactions, setTransactions] = useState<CreditTransaction[]>([])
  const [creditsPage, setCreditsPage] = useState(1)
  const [creditsTotalPages, setCreditsTotalPages] = useState(1)
  const [creditsTotal, setCreditsTotal] = useState(0)
  const [creditSearch, setCreditSearch] = useState('')
  const [creditsLoading, setCreditsLoading] = useState(true)
  const [creditDialogOpen, setCreditDialogOpen] = useState(false)
  const [creditUserId, setCreditUserId] = useState('')
  const [creditUserEmail, setCreditUserEmail] = useState('')
  const [creditAmount, setCreditAmount] = useState('')
  const [creditReason, setCreditReason] = useState('')
  const [creditType, setCreditType] = useState<'add' | 'deduct'>('add')
  const [submitting, setSubmitting] = useState(false)
  const [pricingDialogOpen, setPricingDialogOpen] = useState(false)
  const [pricingUserId, setPricingUserId] = useState('')
  const [pricingMultiplier, setPricingMultiplier] = useState('')
  const [pricingSubmitting, setPricingSubmitting] = useState(false)
  const [userSuggestions, setUserSuggestions] = useState<{ id: string; email: string }[]>([])
  const [pricing, setPricing] = useState<PricingEntry[]>([])
  const [pricingLoading, setPricingLoading] = useState(true)
  const { addToast } = useToast()

  const fetchSummary = useCallback(() => {
    setSummaryLoading(true)
    const params = new URLSearchParams()
    if (dateFrom) params.set('from', dateFrom)
    if (dateTo) params.set('to', dateTo)
    fetch(`/api/admin/finance/summary?${params}`)
      .then((r) => r.json())
      .then(setSummary)
      .catch(() => addToast({ title: 'Failed to load summary', variant: 'destructive' }))
      .finally(() => setSummaryLoading(false))
  }, [dateFrom, dateTo])

  const fetchUsers = useCallback(() => {
    setUsersLoading(true)
    const params = new URLSearchParams({ page: String(usersPage), limit: '10' })
    if (usersSearch) params.set('search', usersSearch)
    fetch(`/api/admin/finance/users?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setUsers(data.users)
        setUsersTotal(data.total)
        setUsersTotalPages(data.totalPages)
      })
      .catch(() => addToast({ title: 'Failed to load users', variant: 'destructive' }))
      .finally(() => setUsersLoading(false))
  }, [usersPage, usersSearch])

  const fetchCredits = useCallback(() => {
    setCreditsLoading(true)
    const params = new URLSearchParams({ page: String(creditsPage), limit: '10' })
    if (creditSearch) params.set('search', creditSearch)
    fetch(`/api/admin/finance/credits?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setTransactions(data.transactions)
        setCreditsTotal(data.total)
        setCreditsTotalPages(data.totalPages)
      })
      .catch(() => addToast({ title: 'Failed to load credits', variant: 'destructive' }))
      .finally(() => setCreditsLoading(false))
  }, [creditsPage, creditSearch])

  useEffect(() => { fetchSummary() }, [fetchSummary])
  useEffect(() => { fetchUsers() }, [fetchUsers])
  useEffect(() => { fetchCredits() }, [fetchCredits])

  // Fetch pricing table
  useEffect(() => {
    setPricingLoading(true)
    fetch('/api/admin/pricing')
      .then((r) => r.json())
      .then((data) => setPricing(data.pricing ?? []))
      .catch(() => addToast({ title: 'Failed to load pricing', variant: 'destructive' }))
      .finally(() => setPricingLoading(false))
  }, [])

  // User email search for credit dialog
  useEffect(() => {
    if (creditUserEmail.length < 2) {
      setUserSuggestions([])
      return
    }
    const timeout = setTimeout(() => {
      fetch(`/api/admin/finance/users?search=${encodeURIComponent(creditUserEmail)}&limit=5`)
        .then((r) => r.json())
        .then((data) => {
          setUserSuggestions(data.users?.map((u: UserRevenue) => ({ id: u.id, email: u.email })) ?? [])
        })
        .catch(() => {})
    }, 300)
    return () => clearTimeout(timeout)
  }, [creditUserEmail])

  async function handleCreditSubmit() {
    const amount = parseFloat(creditAmount)
    if (isNaN(amount) || amount <= 0) {
      addToast({ title: 'Enter a valid positive amount', variant: 'destructive' })
      return
    }
    if (!creditReason.trim()) {
      addToast({ title: 'Reason is required', variant: 'destructive' })
      return
    }
    if (!creditUserId.trim()) {
      addToast({ title: 'Select a valid user', variant: 'destructive' })
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/finance/credits/${creditUserId.trim()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: creditType === 'deduct' ? -amount : amount,
          reason: creditReason.trim(),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to process credit')
      }
      addToast({
        title: `${creditType === 'add' ? 'Credit added' : 'Debit applied'} successfully`,
        variant: 'success',
      })
      setCreditDialogOpen(false)
      setCreditUserId('')
      setCreditUserEmail('')
      setCreditAmount('')
      setCreditReason('')
      setUserSuggestions([])
      fetchCredits()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Operation failed'
      addToast({ title: message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePricingSubmit() {
    const multiplier = parseFloat(pricingMultiplier)
    if (isNaN(multiplier) || multiplier <= 0 || multiplier > 10) {
      addToast({ title: 'Multiplier must be between 0 and 10', variant: 'destructive' })
      return
    }
    if (!pricingUserId.trim()) {
      addToast({ title: 'User ID is required', variant: 'destructive' })
      return
    }

    setPricingSubmitting(true)
    try {
      const res = await fetch(`/api/admin/finance/override-pricing/${pricingUserId.trim()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ multiplier }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update pricing')
      }
      addToast({ title: 'Pricing multiplier updated', variant: 'success' })
      setPricingDialogOpen(false)
      setPricingUserId('')
      setPricingMultiplier('')
      fetchUsers()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Operation failed'
      addToast({ title: message, variant: 'destructive' })
    } finally {
      setPricingSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Finance</h1>
          <p className="text-muted-foreground">Revenue, costs, credits, and pricing controls</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCreditType('add')
              setCreditDialogOpen(true)
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Credit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCreditType('deduct')
              setCreditDialogOpen(true)
            }}
          >
            <Minus className="mr-2 h-4 w-4" />
            Deduct Credit
          </Button>
        </div>
      </div>

      {/* Date Range Selector */}
      <Card>
        <CardContent className="flex items-end gap-4 pt-6">
          <div className="space-y-1.5">
            <Label className="text-muted-foreground">From</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-44"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground">To</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-44"
            />
          </div>
          <Button variant="outline" onClick={fetchSummary}>
            Apply
          </Button>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          {
            title: 'Total Revenue',
            value: summary ? `$${summary.totalRevenue.toFixed(2)}` : '--',
            icon: DollarSign,
            sub: `${summary?.requestCount?.toLocaleString() ?? 0} requests`,
          },
          {
            title: 'Provider Cost',
            value: summary ? `$${summary.providerCost.toFixed(2)}` : '--',
            icon: TrendingUp,
            sub: 'Provider costs',
          },
          {
            title: 'Margin',
            value: summary ? `${summary.margin.toFixed(1)}%` : '--',
            icon: Percent,
            sub: 'Revenue - costs',
          },
          {
            title: 'Requests',
            value: summary?.requestCount?.toLocaleString() ?? '--',
            icon: Activity,
            sub: 'In date range',
          },
        ].map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className={`text-2xl font-bold ${card.title === 'Margin' ? 'text-primary' : 'text-foreground'}`}>
                    {card.value}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Top Spenders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-foreground">Top Spenders</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email..."
                value={usersSearch}
                onChange={(e) => {
                  setUsersSearch(e.target.value)
                  setUsersPage(1)
                }}
                className="pl-8 text-sm"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => setPricingDialogOpen(true)}
            >
              Override Pricing
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {usersLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead className="text-right">Requests</TableHead>
                    <TableHead className="text-right">Total Cost</TableHead>
                    <TableHead className="text-right">Multiplier</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No user data yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div>
                            <p className="text-sm text-foreground/80">{user.name || 'Unnamed'}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {user.requestCount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-sm font-mono text-primary">
                          ${user.totalCost.toFixed(4)}
                        </TableCell>
                        <TableCell className="text-right">
                          {user.pricingMultiplier !== 1.0 ? (
                            <Badge className="bg-amber-500/10 text-amber-400">
                              {user.pricingMultiplier}x
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">1.0x</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {usersTotalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    Page {usersPage} of {usersTotalPages} ({usersTotal} total)
                  </p>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      disabled={usersPage <= 1}
                      onClick={() => setUsersPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      disabled={usersPage >= usersTotalPages}
                      onClick={() => setUsersPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Credit Ledger */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-foreground">Credit Ledger</CardTitle>
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by email..."
              value={creditSearch}
              onChange={(e) => {
                setCreditSearch(e.target.value)
                setCreditsPage(1)
              }}
              className="pl-8 text-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {creditsLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No credit transactions yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell>
                          <div>
                            <p className="text-sm text-foreground/80">{tx.user.name || 'Unnamed'}</p>
                            <p className="text-xs text-muted-foreground">{tx.user.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            className={
                              tx.amount > 0
                                ? 'bg-primary/10 text-primary'
                                : 'bg-red-500/10 text-red-400'
                            }
                          >
                            {tx.amount > 0 ? '+' : ''}${tx.amount.toFixed(2)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {tx.reason}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {tx.adminEmail}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(tx.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {creditsTotalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    Page {creditsPage} of {creditsTotalPages} ({creditsTotal} total)
                  </p>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      disabled={creditsPage <= 1}
                      onClick={() => setCreditsPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      disabled={creditsPage >= creditsTotalPages}
                      onClick={() => setCreditsPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Pricing Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Model Pricing</CardTitle>
          <p className="text-sm text-muted-foreground">Current token pricing per 1M tokens (read-only)</p>
        </CardHeader>
        <CardContent className="p-0">
          {pricingLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Input / 1M tokens</TableHead>
                  <TableHead className="text-right">Output / 1M tokens</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pricing.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No pricing data available
                    </TableCell>
                  </TableRow>
                ) : (
                  pricing.map((entry) => {
                    const provider = entry.model.startsWith('gpt') || entry.model.startsWith('o1')
                      ? 'OpenAI'
                      : entry.model.startsWith('claude')
                      ? 'Anthropic'
                      : entry.model.startsWith('gemini')
                      ? 'Google'
                      : entry.model.startsWith('mistral') || entry.model.startsWith('codestral')
                      ? 'Mistral'
                      : 'Unknown'
                    return (
                      <TableRow key={entry.model}>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {provider}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm text-foreground/80">
                          {entry.model}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-muted-foreground">
                          ${entry.inputPer1M.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-primary">
                          ${entry.outputPer1M.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Deduct Credit Dialog */}
      <Dialog open={creditDialogOpen} onOpenChange={setCreditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{creditType === 'add' ? 'Add Credit' : 'Deduct Credit'}</DialogTitle>
            <DialogDescription>
              {creditType === 'add'
                ? 'Add credit balance to a user account (e.g. promotions, refunds).'
                : 'Deduct credit balance from a user account.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>User email</Label>
              <div className="relative">
                <Input
                  value={creditUserEmail}
                  onChange={(e) => {
                    setCreditUserEmail(e.target.value)
                    setCreditUserId('')
                  }}
                  placeholder="user@example.com"
                />
                {userSuggestions.length > 0 && creditUserEmail.length >= 2 && !creditUserId && (
                  <div className="absolute z-10 top-full mt-1 w-full rounded-lg border border-border bg-muted shadow-lg">
                    {userSuggestions.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm text-foreground/80 hover:bg-card first:rounded-t-lg last:rounded-b-lg cursor-pointer"
                        onClick={() => {
                          setCreditUserEmail(u.email)
                          setCreditUserId(u.id)
                          setUserSuggestions([])
                        }}
                      >
                        {u.email}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Amount ($)</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
                placeholder="Justification for this credit adjustment..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreditDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreditSubmit}
                disabled={submitting || !creditUserId.trim() || !creditReason.trim() || !creditAmount}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {creditType === 'add' ? 'Add Credit' : 'Deduct Credit'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Override Pricing Dialog */}
      <Dialog open={pricingDialogOpen} onOpenChange={setPricingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override Pricing Multiplier</DialogTitle>
            <DialogDescription>
              Set a custom pricing multiplier for a user. 1.0 = standard pricing. 0.8 = 20% discount. 1.5 = 50% premium.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>User ID</Label>
              <Input
                value={pricingUserId}
                onChange={(e) => setPricingUserId(e.target.value)}
                placeholder="Enter user ID (cuid)"
              />
            </div>
            <div className="space-y-2">
              <Label>Pricing Multiplier</Label>
              <Input
                type="number"
                min="0.01"
                max="10"
                step="0.01"
                value={pricingMultiplier}
                onChange={(e) => setPricingMultiplier(e.target.value)}
                placeholder="1.0"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPricingDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handlePricingSubmit}
                disabled={pricingSubmitting || !pricingUserId.trim() || !pricingMultiplier}
              >
                {pricingSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Pricing
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
