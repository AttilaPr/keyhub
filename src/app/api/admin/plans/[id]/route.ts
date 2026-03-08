import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin'
import prisma from '@/lib/prisma'
import { logAuditEvent, getRequestMeta } from '@/lib/audit'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { id } = await params
  const body = await req.json()

  const plan = await prisma.plan.findUnique({ where: { id } })
  if (!plan) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
  }

  const data: Record<string, unknown> = {}
  const allowedFields = [
    'name',
    'monthlyPriceUsd',
    'requestsPerMonth',
    'platformKeysLimit',
    'providerKeysLimit',
    'teamMembersLimit',
    'logsRetentionDays',
    'apiRateLimit',
  ]

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      if (field === 'name') {
        if (typeof body.name !== 'string' || !body.name.trim()) continue
        // Check name uniqueness
        const existing = await prisma.plan.findUnique({ where: { name: body.name.trim() } })
        if (existing && existing.id !== id) {
          return NextResponse.json({ error: 'A plan with this name already exists' }, { status: 400 })
        }
        data.name = body.name.trim()
      } else {
        data[field] = body[field]
      }
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const updated = await prisma.plan.update({ where: { id }, data })

  const meta = getRequestMeta(req)
  await logAuditEvent({
    actorId: session.user.id,
    action: 'admin.plan.updated',
    targetType: 'Plan',
    targetId: id,
    metadata: data,
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  return NextResponse.json({ plan: updated })
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { id } = await params

  const plan = await prisma.plan.findUnique({ where: { id } })
  if (!plan) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
  }

  // Check if any users/orgs are on this plan
  const [userCount, orgCount] = await Promise.all([
    prisma.user.count({ where: { planId: id } }),
    prisma.organization.count({ where: { planId: id } }),
  ])

  if (userCount > 0 || orgCount > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete plan with ${userCount} users and ${orgCount} organizations assigned. Reassign them first.`,
      },
      { status: 400 }
    )
  }

  await prisma.plan.delete({ where: { id } })

  const meta = getRequestMeta(req)
  await logAuditEvent({
    actorId: session.user.id,
    action: 'admin.plan.deleted',
    targetType: 'Plan',
    targetId: id,
    metadata: { name: plan.name },
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  return NextResponse.json({ success: true })
}
