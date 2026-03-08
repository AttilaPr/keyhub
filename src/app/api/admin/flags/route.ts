import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin'
import prisma from '@/lib/prisma'

export async function GET() {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const flags = await prisma.featureFlag.findMany({
    orderBy: { key: 'asc' },
  })

  return NextResponse.json({ flags })
}

export async function POST(req: Request) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { key, description } = body as { key?: string; description?: string }

  if (!key || typeof key !== 'string') {
    return NextResponse.json({ error: 'key is required' }, { status: 400 })
  }

  // Validate key format: lowercase alphanumeric + underscores
  if (!/^[a-z][a-z0-9_]*$/.test(key)) {
    return NextResponse.json(
      { error: 'Key must be lowercase alphanumeric with underscores, starting with a letter' },
      { status: 400 }
    )
  }

  const existing = await prisma.featureFlag.findUnique({ where: { key } })
  if (existing) {
    return NextResponse.json({ error: 'Flag already exists' }, { status: 409 })
  }

  const flag = await prisma.featureFlag.create({
    data: {
      key,
      description: description || null,
      updatedBy: session.user.email ?? session.user.id,
    },
  })

  return NextResponse.json({ flag }, { status: 201 })
}
