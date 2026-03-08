import { NextResponse } from 'next/server'
import { auth } from '@/auth'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const forwarded = req.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip') ?? '127.0.0.1'

  return NextResponse.json({ ip })
}
