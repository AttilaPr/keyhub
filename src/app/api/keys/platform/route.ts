import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { generatePlatformKey } from '@/lib/platform-key'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const keys = await prisma.platformKey.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      label: true,
      keyPrefix: true,
      isActive: true,
      lastUsedAt: true,
      createdAt: true,
      _count: { select: { logs: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(keys)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { label } = await req.json()
  if (!label) return NextResponse.json({ error: 'Label required' }, { status: 400 })

  const { raw, prefix, hash } = generatePlatformKey()

  const key = await prisma.platformKey.create({
    data: {
      userId: session.user.id,
      label,
      keyHash: hash,
      keyPrefix: prefix,
    },
  })

  // Return raw key only once
  return NextResponse.json({
    id: key.id,
    label: key.label,
    keyPrefix: key.keyPrefix,
    rawKey: raw,
  }, { status: 201 })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  await prisma.platformKey.deleteMany({
    where: { id, userId: session.user.id },
  })

  return NextResponse.json({ success: true })
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, isActive } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  await prisma.platformKey.updateMany({
    where: { id, userId: session.user.id },
    data: { isActive },
  })

  return NextResponse.json({ success: true })
}
