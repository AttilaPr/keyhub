import { NextResponse } from 'next/server'
import { cleanupRateLimits } from '@/lib/rate-limit'

export async function GET(req: Request) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const deleted = await cleanupRateLimits()
    return NextResponse.json({ deleted, timestamp: new Date().toISOString() })
  } catch (err) {
    console.error('[cron] Rate limit cleanup failed:', err)
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 })
  }
}
