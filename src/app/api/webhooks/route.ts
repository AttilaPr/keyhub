import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import crypto from 'crypto'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // If endpointId query param is set, return delivery history for that endpoint
  const { searchParams } = new URL(req.url)
  const endpointId = searchParams.get('endpointId')

  if (endpointId) {
    // Verify ownership
    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { id: endpointId, userId: session.user.id },
      select: { id: true },
    })
    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 })
    }

    const deliveries = await prisma.webhookDelivery.findMany({
      where: { endpointId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        event: true,
        statusCode: true,
        responseBody: true,
        attemptCount: true,
        deliveredAt: true,
        failedAt: true,
        createdAt: true,
      },
    })

    return NextResponse.json(deliveries)
  }

  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { userId: session.user.id },
    include: {
      _count: { select: { deliveries: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(endpoints)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { url, events } = await req.json()

  if (!url?.trim()) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  try {
    new URL(url)
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  if (!Array.isArray(events) || events.length === 0) {
    return NextResponse.json({ error: 'At least one event is required' }, { status: 400 })
  }

  const secret = crypto.randomBytes(32).toString('hex')

  const endpoint = await prisma.webhookEndpoint.create({
    data: {
      userId: session.user.id,
      url: url.trim(),
      secret,
      events,
    },
  })

  return NextResponse.json({
    ...endpoint,
    secret, // Show once on creation
  }, { status: 201 })
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, active, url, events } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const data: Record<string, unknown> = {}
  if (typeof active === 'boolean') data.active = active
  if (typeof url === 'string' && url.trim()) data.url = url.trim()
  if (Array.isArray(events)) data.events = events

  await prisma.webhookEndpoint.updateMany({
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

  await prisma.webhookEndpoint.deleteMany({
    where: { id, userId: session.user.id },
  })

  return NextResponse.json({ success: true })
}
