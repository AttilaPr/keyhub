import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const url = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10)))
  const search = url.searchParams.get('search') ?? ''

  const where = search
    ? {
        user: {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { name: { contains: search, mode: 'insensitive' as const } },
          ],
        },
      }
    : {}

  const [transactions, total] = await Promise.all([
    prisma.creditTransaction.findMany({
      where,
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.creditTransaction.count({ where }),
  ])

  // Enrich with admin email
  const adminIds = [...new Set(transactions.map((t) => t.adminId))]
  const admins = adminIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: adminIds } },
        select: { id: true, email: true },
      })
    : []
  const adminMap = new Map(admins.map((a) => [a.id, a.email]))

  const enrichedTransactions = transactions.map((t) => ({
    ...t,
    adminEmail: adminMap.get(t.adminId) ?? 'Unknown',
  }))

  return NextResponse.json({
    transactions: enrichedTransactions,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  })
}
