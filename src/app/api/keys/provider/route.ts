import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { encryptKey, decryptKey } from '@/lib/encryption'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const keys = await prisma.providerKey.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      provider: true,
      label: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(keys)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { provider, label, apiKey } = await req.json()

  if (!provider || !label || !apiKey) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const existing = await prisma.providerKey.findUnique({
    where: { userId_provider: { userId: session.user.id, provider } },
  })

  if (existing) {
    const updated = await prisma.providerKey.update({
      where: { id: existing.id },
      data: {
        label,
        encryptedKey: encryptKey(apiKey),
        isActive: true,
      },
    })
    return NextResponse.json({ id: updated.id, provider, label })
  }

  const key = await prisma.providerKey.create({
    data: {
      userId: session.user.id,
      provider,
      label,
      encryptedKey: encryptKey(apiKey),
    },
  })

  return NextResponse.json({ id: key.id, provider, label }, { status: 201 })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  await prisma.providerKey.deleteMany({
    where: { id, userId: session.user.id },
  })

  return NextResponse.json({ success: true })
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, isActive } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const key = await prisma.providerKey.updateMany({
    where: { id, userId: session.user.id },
    data: { isActive },
  })

  return NextResponse.json({ success: true })
}
