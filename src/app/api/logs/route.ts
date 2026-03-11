import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { resolveUserId } from '@/lib/api-auth'

export async function GET(req: Request) {
  const userId = await resolveUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50))
  const provider = searchParams.get('provider')
  const status = searchParams.get('status')
  const model = searchParams.get('model')
  const platformKeyId = searchParams.get('platformKeyId')
  const tag = searchParams.get('tag')

  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const search = searchParams.get('search')

  const sortBy = searchParams.get('sortBy') || 'createdAt'
  const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc'
  const allowedSortFields = ['createdAt', 'totalTokens', 'costUsd', 'latencyMs', 'provider', 'model', 'status']
  const orderByField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt'

  // Use full-text search with $queryRaw when search query is provided
  if (search && search.trim().length > 0) {
    // Sanitize search query for tsquery: replace special chars and join words with &
    const sanitized = search.trim().replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(Boolean).join(' & ')
    if (sanitized.length === 0) {
      return NextResponse.json({ logs: [], total: 0, page, limit })
    }

    // Build WHERE conditions
    const conditions: string[] = [`r."userId" = $1`]
    const params: any[] = [userId]
    let paramIndex = 2

    // Full-text search condition
    conditions.push(`(to_tsvector('english', r."prompt") @@ to_tsquery('english', $${paramIndex}) OR to_tsvector('english', COALESCE(r."response", '')) @@ to_tsquery('english', $${paramIndex}))`)
    params.push(sanitized)
    paramIndex++

    if (provider) { conditions.push(`r."provider" = $${paramIndex}`); params.push(provider); paramIndex++ }
    if (status) { conditions.push(`r."status" = $${paramIndex}`); params.push(status); paramIndex++ }
    if (model) { conditions.push(`r."model" = $${paramIndex}`); params.push(model); paramIndex++ }
    if (platformKeyId) { conditions.push(`r."platformKeyId" = $${paramIndex}`); params.push(platformKeyId); paramIndex++ }
    if (tag) { conditions.push(`r."tag" = $${paramIndex}`); params.push(tag); paramIndex++ }
    if (from) { conditions.push(`r."createdAt" >= $${paramIndex}::timestamptz`); params.push(new Date(from).toISOString()); paramIndex++ }
    if (to) {
      const toDate = new Date(to)
      toDate.setHours(23, 59, 59, 999)
      conditions.push(`r."createdAt" <= $${paramIndex}::timestamptz`)
      params.push(toDate.toISOString())
      paramIndex++
    }

    const whereClause = conditions.join(' AND ')

    // Map allowed sort fields to exact SQL column references (prevents injection)
    const sortFieldMap: Record<string, string> = {
      createdAt: '"createdAt"',
      totalTokens: '"totalTokens"',
      costUsd: '"costUsd"',
      latencyMs: '"latencyMs"',
      provider: '"provider"',
      model: '"model"',
      status: '"status"',
    }
    const quotedOrderBy = sortFieldMap[orderByField] || '"createdAt"'
    const sqlOrder = sortOrder === 'asc' ? 'ASC' : 'DESC'

    // Add LIMIT and OFFSET as parameterized values
    const limitParamIdx = paramIndex
    params.push(limit)
    paramIndex++
    const offsetParamIdx = paramIndex
    params.push((page - 1) * limit)
    paramIndex++

    // Use tagged template for raw query
    const countResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) as count FROM "RequestLog" r WHERE ${whereClause}`,
      ...params.slice(0, limitParamIdx - 1) // count query doesn't need LIMIT/OFFSET params
    )
    const total = Number(countResult[0]?.count || 0)

    const logs = await prisma.$queryRawUnsafe<any[]>(
      `SELECT r."id", r."provider", r."model", r."promptTokens", r."completionTokens",
              r."totalTokens", r."costUsd", r."status", r."errorMessage", r."latencyMs",
              r."createdAt", r."prompt", r."response", r."tag", r."platformKeyId",
              r."fallbackUsed", r."originalProvider", r."fallbackProvider",
              pk."label" as "pkLabel", pk."keyPrefix" as "pkKeyPrefix"
       FROM "RequestLog" r
       LEFT JOIN "PlatformKey" pk ON pk."id" = r."platformKeyId"
       WHERE ${whereClause}
       ORDER BY r.${quotedOrderBy} ${sqlOrder}
       LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}`,
      ...params
    )

    const formattedLogs = logs.map((l: any) => ({
      id: l.id,
      provider: l.provider,
      model: l.model,
      promptTokens: l.promptTokens,
      completionTokens: l.completionTokens,
      totalTokens: l.totalTokens,
      costUsd: typeof l.costUsd === 'number' ? l.costUsd : parseFloat(l.costUsd),
      status: l.status,
      errorMessage: l.errorMessage,
      latencyMs: l.latencyMs,
      createdAt: l.createdAt,
      prompt: l.prompt,
      response: l.response,
      tag: l.tag,
      fallbackUsed: l.fallbackUsed ?? false,
      originalProvider: l.originalProvider ?? null,
      fallbackProvider: l.fallbackProvider ?? null,
      platformKey: { label: l.pkLabel || 'Unknown', keyPrefix: l.pkKeyPrefix || '???' },
    }))

    return NextResponse.json({ logs: formattedLogs, total, page, limit })
  }

  // Standard Prisma query (no full-text search)
  const where: any = { userId: userId }
  if (provider) where.provider = provider
  if (status) where.status = status
  if (model) where.model = model
  if (platformKeyId) where.platformKeyId = platformKeyId
  if (tag) where.tag = tag
  if (from || to) {
    where.createdAt = {}
    if (from) where.createdAt.gte = new Date(from)
    if (to) {
      const toDate = new Date(to)
      toDate.setHours(23, 59, 59, 999)
      where.createdAt.lte = toDate
    }
  }

  const [logs, total] = await Promise.all([
    prisma.requestLog.findMany({
      where,
      orderBy: { [orderByField]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        provider: true,
        model: true,
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        costUsd: true,
        status: true,
        errorMessage: true,
        latencyMs: true,
        createdAt: true,
        prompt: true,
        response: true,
        tag: true,
        fallbackUsed: true,
        originalProvider: true,
        fallbackProvider: true,
        platformKey: { select: { label: true, keyPrefix: true } },
      },
    }),
    prisma.requestLog.count({ where }),
  ])

  return NextResponse.json({ logs, total, page, limit })
}
