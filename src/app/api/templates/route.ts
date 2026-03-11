import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50))
  const skip = (page - 1) * limit

  const where = { userId: session.user.id }

  const [templates, total] = await Promise.all([
    prisma.promptTemplate.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.promptTemplate.count({ where }),
  ])

  // Compute usage count per template: count RequestLog entries whose tag matches the template id
  const templateIds = templates.map((t) => t.id)
  const usageCounts: Map<string, number> = new Map()

  if (templateIds.length > 0) {
    const tagCounts = await prisma.requestLog.groupBy({
      by: ['tag'],
      where: {
        userId: session.user.id,
        tag: { in: templateIds },
      },
      _count: true,
    })

    for (const tc of tagCounts) {
      if (tc.tag) {
        usageCounts.set(tc.tag, tc._count)
      }
    }
  }

  const templatesWithUsage = templates.map((t) => ({
    ...t,
    usageCount: usageCounts.get(t.id) || 0,
  }))

  return NextResponse.json({ templates: templatesWithUsage, total, page, limit })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, description, systemPrompt } = await req.json()

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }
  if (!systemPrompt?.trim()) {
    return NextResponse.json({ error: 'System prompt is required' }, { status: 400 })
  }

  const template = await prisma.promptTemplate.create({
    data: {
      userId: session.user.id,
      name: name.trim(),
      description: description?.trim() || null,
      systemPrompt: systemPrompt.trim(),
    },
  })

  return NextResponse.json(template, { status: 201 })
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, name, description, systemPrompt } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const data: Record<string, unknown> = {}
  if (typeof name === 'string' && name.trim()) data.name = name.trim()
  if (description !== undefined) data.description = description?.trim() || null
  if (typeof systemPrompt === 'string' && systemPrompt.trim()) data.systemPrompt = systemPrompt.trim()

  await prisma.promptTemplate.updateMany({
    where: { id, userId: session.user.id },
    data,
  })

  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  await prisma.promptTemplate.deleteMany({
    where: { id, userId: session.user.id },
  })

  return NextResponse.json({ success: true })
}
