'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'

interface Org {
  id: string
  name: string
  slug: string
  suspended: boolean
  createdAt: string
  _count: { members: number }
  keyCount: number
  totalSpend: number
}

export default function AdminOrgsPage() {
  const router = useRouter()
  const [orgs, setOrgs] = useState<Org[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const { addToast } = useToast()

  function fetchOrgs() {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (search) params.set('search', search)
    fetch(`/api/admin/orgs?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load organizations')
        return res.json()
      })
      .then((data) => {
        setOrgs(data.orgs)
        setTotal(data.total)
      })
      .catch(() => {
        addToast({ title: 'Failed to load organizations', variant: 'destructive' })
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchOrgs() }, [page])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    fetchOrgs()
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Organizations</h1>
          <p className="text-muted-foreground">{total} total organizations</p>
        </div>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or slug..."
            className="pl-10"
          />
        </div>
        <Button type="submit" variant="outline">Search</Button>
      </form>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Members</TableHead>
                <TableHead className="text-right">Keys</TableHead>
                <TableHead className="text-right">Total Spend</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : orgs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No organizations found
                  </TableCell>
                </TableRow>
              ) : (
                orgs.map((org) => (
                  <TableRow
                    key={org.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/admin/orgs/${org.id}`)}
                  >
                    <TableCell>
                      <p className="text-sm font-medium text-foreground">{org.name}</p>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm font-mono">
                      {org.slug}
                    </TableCell>
                    <TableCell>
                      {org.suspended ? (
                        <Badge className="bg-red-500/10 text-red-400">Suspended</Badge>
                      ) : (
                        <Badge className="bg-primary/10 text-primary">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      {org._count.members}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      {org.keyCount}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm font-mono">
                      ${org.totalSpend.toFixed(4)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(org.createdAt).toLocaleDateString()}
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
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
