import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const isAdmin = session.user.role === 'SUPER_ADMIN'

  const now = new Date()

  const announcements = await prisma.announcement.findMany({
    where: {
      publishedAt: { lte: now },
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ],
      targetRole: isAdmin ? undefined : 'all',
      dismissals: {
        none: { userId },
      },
    },
    orderBy: [
      { type: 'asc' }, // critical first (alphabetically: critical < info < warning)
      { publishedAt: 'desc' },
    ],
    select: {
      id: true,
      title: true,
      body: true,
      type: true,
      targetRole: true,
      publishedAt: true,
      expiresAt: true,
    },
  })

  // Re-sort so critical comes first, then warning, then info
  const typeOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 }
  announcements.sort((a, b) => {
    const oa = typeOrder[a.type] ?? 3
    const ob = typeOrder[b.type] ?? 3
    if (oa !== ob) return oa - ob
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  })

  return NextResponse.json({ announcements })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()

  if (body.action === 'dismiss') {
    const { announcementId } = body
    if (!announcementId) {
      return NextResponse.json({ error: 'Missing announcementId' }, { status: 400 })
    }

    await prisma.announcementDismissal.upsert({
      where: {
        announcementId_userId: {
          announcementId,
          userId: session.user.id,
        },
      },
      create: {
        announcementId,
        userId: session.user.id,
      },
      update: {},
    })

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
