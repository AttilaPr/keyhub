import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin'
import prisma from '@/lib/prisma'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { id } = await params
  const body = await req.json()
  const { title, body: content, type, targetRole, expiresAt } = body

  const existing = await prisma.announcement.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Announcement not found' }, { status: 404 })
  }

  const data: Record<string, unknown> = {}
  if (typeof title === 'string' && title.trim()) data.title = title.trim()
  if (typeof content === 'string' && content.trim()) data.body = content.trim()
  if (type && ['info', 'warning', 'critical'].includes(type)) data.type = type
  if (targetRole && ['all', 'admin'].includes(targetRole)) data.targetRole = targetRole
  if (expiresAt !== undefined) data.expiresAt = expiresAt ? new Date(expiresAt) : null

  const announcement = await prisma.announcement.update({
    where: { id },
    data,
  })

  return NextResponse.json({ announcement })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { id } = await params

  const existing = await prisma.announcement.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Announcement not found' }, { status: 404 })
  }

  await prisma.announcement.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
