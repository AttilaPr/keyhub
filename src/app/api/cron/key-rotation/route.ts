import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { keyRotationReminderEmail } from '@/lib/email-templates'

/**
 * GET /api/cron/key-rotation
 *
 * Cron endpoint: finds provider keys overdue for rotation and sends
 * reminder emails to users who have emailKeyRotation enabled.
 *
 * Protected by CRON_SECRET env var — pass as Authorization: Bearer <secret>.
 */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[cron/key-rotation] CRON_SECRET env var is not set')
    return NextResponse.json({ error: 'Cron not configured' }, { status: 500 })
  }

  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (token !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Find all provider keys with rotation reminders enabled
  const keys = await prisma.providerKey.findMany({
    where: {
      rotationReminderDays: { not: null },
      isActive: true,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          emailKeyRotation: true,
        },
      },
    },
  })

  const now = new Date()
  let emailsSent = 0
  let keysChecked = 0

  for (const key of keys) {
    keysChecked++

    if (!key.rotationReminderDays) continue
    if (!key.user.emailKeyRotation) continue

    // Determine if key is overdue for rotation
    const lastRotated = key.lastRotatedAt || key.createdAt
    const daysSinceRotation = Math.floor(
      (now.getTime() - new Date(lastRotated).getTime()) / (1000 * 60 * 60 * 24)
    )

    if (daysSinceRotation < key.rotationReminderDays) continue

    // Key is overdue — send reminder
    try {
      const html = keyRotationReminderEmail(key.provider, daysSinceRotation)
      await sendEmail(
        key.user.email,
        `Key Rotation Reminder: ${key.provider} — KeyHub`,
        html
      )
      emailsSent++
    } catch (err) {
      console.error(
        `[cron/key-rotation] Failed to send email for key ${key.id}:`,
        err
      )
    }
  }

  return NextResponse.json({
    success: true,
    keysChecked,
    emailsSent,
    timestamp: now.toISOString(),
  })
}
