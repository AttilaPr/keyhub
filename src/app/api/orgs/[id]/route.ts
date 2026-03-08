import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { requireOrgRole, generateSlug } from '@/lib/org-permissions'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const check = await requireOrgRole(id, session.user.id, 'ADMIN')
  if (!check.allowed) return NextResponse.json({ error: check.error }, { status: 403 })

  const { name, slug } = await req.json()
  const data: Record<string, string> = {}

  if (typeof name === 'string' && name.trim()) {
    data.name = name.trim()
  }

  if (typeof slug === 'string' && slug.trim()) {
    const newSlug = generateSlug(slug.trim())
    if (!newSlug) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })

    const existing = await prisma.organization.findFirst({
      where: { slug: newSlug, NOT: { id } },
    })
    if (existing) return NextResponse.json({ error: 'Slug already taken' }, { status: 409 })
    data.slug = newSlug
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const org = await prisma.organization.update({
    where: { id },
    data,
  })

  return NextResponse.json({ id: org.id, name: org.name, slug: org.slug })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const check = await requireOrgRole(id, session.user.id, 'OWNER')
  if (!check.allowed) return NextResponse.json({ error: check.error }, { status: 403 })

  await prisma.organization.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
