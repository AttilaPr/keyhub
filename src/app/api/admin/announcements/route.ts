import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin'
import prisma from '@/lib/prisma'

export async function GET() {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const announcements = await prisma.announcement.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      creator: {
        select: { id: true, name: true, email: true },
      },
      _count: {
        select: { dismissals: true },
      },
    },
  })

  return NextResponse.json({ announcements })
}

export async function POST(req: Request) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { title, body: content, type, targetRole, expiresAt } = body

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }
  if (!content?.trim()) {
    return NextResponse.json({ error: 'Body is required' }, { status: 400 })
  }
  if (!['info', 'warning', 'critical'].includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }
  if (!['all', 'admin'].includes(targetRole || 'all')) {
    return NextResponse.json({ error: 'Invalid targetRole' }, { status: 400 })
  }

  const announcement = await prisma.announcement.create({
    data: {
      title: title.trim(),
      body: content.trim(),
      type,
      targetRole: targetRole || 'all',
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdBy: session.user.id,
    },
  })

  return NextResponse.json({ announcement }, { status: 201 })
}
