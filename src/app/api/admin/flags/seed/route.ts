import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin'
import prisma from '@/lib/prisma'

const DEFAULT_FLAGS = [
  { key: 'teams', description: 'Teams & Organizations feature' },
  { key: 'playground', description: 'In-app AI Playground' },
  { key: 'semantic_cache', description: 'Semantic response caching' },
  { key: 'anomaly_detection', description: 'Anomaly detection engine' },
  { key: 'webhooks', description: 'Webhook notifications' },
  { key: 'mfa', description: 'Multi-factor authentication' },
]

export async function POST() {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let created = 0
  let skipped = 0

  for (const flag of DEFAULT_FLAGS) {
    const existing = await prisma.featureFlag.findUnique({
      where: { key: flag.key },
    })
    if (existing) {
      skipped++
      continue
    }
    await prisma.featureFlag.create({
      data: {
        key: flag.key,
        description: flag.description,
        updatedBy: session.user.email ?? session.user.id,
      },
    })
    created++
  }

  return NextResponse.json({ created, skipped })
}
