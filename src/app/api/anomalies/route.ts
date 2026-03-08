import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { detectAnomalies } from '@/lib/anomaly'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Run detection
  await detectAnomalies(session.user.id)

  // Return recent events
  const events = await prisma.anomalyEvent.findMany({
    where: { userId: session.user.id },
    orderBy: { detectedAt: 'desc' },
    take: 20,
  })

  return NextResponse.json(events)
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  await prisma.anomalyEvent.updateMany({
    where: { id, userId: session.user.id },
    data: { acknowledgedAt: new Date() },
  })

  return NextResponse.json({ success: true })
}
