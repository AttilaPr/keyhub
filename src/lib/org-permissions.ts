import prisma from '@/lib/prisma'
import { OrgRole } from '@prisma/client'

const ROLE_HIERARCHY: Record<OrgRole, number> = {
  OWNER: 3,
  ADMIN: 2,
  MEMBER: 1,
}

export async function getOrgMembership(orgId: string, userId: string) {
  return prisma.organizationMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
  })
}

export async function requireOrgRole(
  orgId: string,
  userId: string,
  minRole: OrgRole
): Promise<{ allowed: true; role: OrgRole } | { allowed: false; error: string }> {
  const membership = await getOrgMembership(orgId, userId)
  if (!membership) {
    return { allowed: false, error: 'Not a member of this organization' }
  }
  if (ROLE_HIERARCHY[membership.role] < ROLE_HIERARCHY[minRole]) {
    return { allowed: false, error: 'Insufficient permissions' }
  }
  return { allowed: true, role: membership.role }
}

/** Returns membership or null. Use when any member should have access. */
export async function requireOrgMember(orgId: string, userId: string) {
  return getOrgMembership(orgId, userId)
}

/** Returns membership if user is ADMIN or OWNER, otherwise null. */
export async function requireOrgAdmin(orgId: string, userId: string) {
  const membership = await getOrgMembership(orgId, userId)
  if (!membership) return null
  if (membership.role === 'OWNER' || membership.role === 'ADMIN') return membership
  return null
}

/** Returns membership if user is OWNER, otherwise null. */
export async function requireOrgOwner(orgId: string, userId: string) {
  const membership = await getOrgMembership(orgId, userId)
  if (!membership) return null
  if (membership.role === 'OWNER') return membership
  return null
}

export async function isOrgOwner(orgId: string, userId: string): Promise<boolean> {
  const membership = await getOrgMembership(orgId, userId)
  return membership?.role === 'OWNER'
}

export async function isOrgAdmin(orgId: string, userId: string): Promise<boolean> {
  const membership = await getOrgMembership(orgId, userId)
  return membership?.role === 'OWNER' || membership?.role === 'ADMIN'
}

export async function isOrgMember(orgId: string, userId: string): Promise<boolean> {
  const membership = await getOrgMembership(orgId, userId)
  return !!membership
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}
