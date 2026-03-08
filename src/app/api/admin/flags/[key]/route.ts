import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin'
import prisma from '@/lib/prisma'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { key } = await params

  const existing = await prisma.featureFlag.findUnique({ where: { key } })
  if (!existing) {
    return NextResponse.json({ error: 'Flag not found' }, { status: 404 })
  }

  const body = await req.json()
  const { enabled, rolloutPercent, allowedUserIds, allowedPlanIds, description } = body as {
    enabled?: boolean
    rolloutPercent?: number
    allowedUserIds?: string[]
    allowedPlanIds?: string[]
    description?: string
  }

  const data: Record<string, unknown> = {
    updatedBy: session.user.email ?? session.user.id,
  }

  if (typeof enabled === 'boolean') data.enabled = enabled
  if (typeof description === 'string') data.description = description
  if (typeof rolloutPercent === 'number') {
    if (rolloutPercent < 0 || rolloutPercent > 100) {
      return NextResponse.json({ error: 'rolloutPercent must be 0-100' }, { status: 400 })
    }
    data.rolloutPercent = rolloutPercent
  }
  if (Array.isArray(allowedUserIds)) data.allowedUserIds = allowedUserIds
  if (Array.isArray(allowedPlanIds)) data.allowedPlanIds = allowedPlanIds

  const flag = await prisma.featureFlag.update({
    where: { key },
    data,
  })

  return NextResponse.json({ flag })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { key } = await params

  const existing = await prisma.featureFlag.findUnique({ where: { key } })
  if (!existing) {
    return NextResponse.json({ error: 'Flag not found' }, { status: 404 })
  }

  await prisma.featureFlag.delete({ where: { key } })

  return NextResponse.json({ success: true })
}
