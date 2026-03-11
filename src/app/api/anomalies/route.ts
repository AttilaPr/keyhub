import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { detectAnomalies } from '@/lib/anomaly'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = (session as any).activeOrgId ?? null

  // Run detection
  await detectAnomalies(session.user.id)

  // Return recent events (org-scoped)
  const scope = orgId ? { orgId } : { userId: session.user.id, orgId: null }
  const events = await prisma.anomalyEvent.findMany({
    where: { ...scope },
    orderBy: { detectedAt: 'desc' },
    take: 20,
  })

  return NextResponse.json(events)
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = (session as any).activeOrgId ?? null
  const scope = orgId ? { orgId } : { userId: session.user.id, orgId: null }

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  await prisma.anomalyEvent.updateMany({
    where: { id, ...scope },
    data: { acknowledgedAt: new Date() },
  })

  return NextResponse.json({ success: true })
}
