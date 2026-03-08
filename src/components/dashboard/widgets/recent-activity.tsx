'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowRightIcon } from '@/components/ui/arrow-right'
import { formatCurrency, timeAgo } from '@/lib/utils'
import type { LatestRequest } from '@/types/dashboard'

interface RecentActivityProps {
  latestRequests: LatestRequest[]
}

export function RecentActivity({ latestRequests }: RecentActivityProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-foreground">Recent Activity</CardTitle>
          <CardDescription>Latest API requests</CardDescription>
        </div>
        <Link
          href="/logs"
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          View all
          <ArrowRightIcon size={14} />
        </Link>
      </CardHeader>
      <CardContent>
        {latestRequests.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Tokens</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {latestRequests.map((req) => (
                <TableRow key={req.id}>
                  <TableCell>
                    <div className="font-mono text-xs text-muted-foreground">{req.model}</div>
                    <span className="text-xs text-muted-foreground capitalize">{req.provider}</span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={req.status === 'success' ? 'default' : 'destructive'}
                      className={req.status === 'success' ? 'bg-primary/10 text-primary' : undefined}
                    >
                      {req.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground text-xs">
                    {req.totalTokens.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground text-xs">
                    {formatCurrency(req.costUsd)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground text-xs whitespace-nowrap">
                    {timeAgo(new Date(req.createdAt))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex h-[200px] items-center justify-center text-muted-foreground">
            No requests yet. Make an API call to see activity here.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
