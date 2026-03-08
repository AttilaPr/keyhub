import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      emailBudgetAlerts: true,
      emailAnomalyAlerts: true,
      emailKeyRotation: true,
      emailKeyExpiry: true,
      anomalyDetectionEnabled: true,
      anomalyThresholdSigma: true,
      anomalyNotifyEmail: true,
      anomalyNotifyWebhook: true,
    },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json(user)
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()

  const allowedFields = [
    'emailBudgetAlerts',
    'emailAnomalyAlerts',
    'emailKeyRotation',
    'emailKeyExpiry',
    'anomalyDetectionEnabled',
    'anomalyThresholdSigma',
    'anomalyNotifyEmail',
    'anomalyNotifyWebhook',
  ]

  const data: Record<string, boolean | number> = {}

  for (const field of allowedFields) {
    if (field in body) {
      if (field === 'anomalyThresholdSigma') {
        const val = Number(body[field])
        if (isNaN(val) || val < 1.0 || val > 10.0) {
          return NextResponse.json(
            { error: 'anomalyThresholdSigma must be between 1.0 and 10.0' },
            { status: 400 },
          )
        }
        data[field] = val
      } else {
        if (typeof body[field] !== 'boolean') {
          return NextResponse.json(
            { error: `${field} must be a boolean` },
            { status: 400 },
          )
        }
        data[field] = body[field]
      }
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data,
  })

  return NextResponse.json({ success: true })
}
