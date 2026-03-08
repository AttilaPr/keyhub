import prisma from '@/lib/prisma'

interface PlanLimitResult {
  allowed: boolean
  current: number
  limit: number
}

/**
 * Check whether a user has exceeded their plan limit for a given resource.
 *
 * Resources: 'platformKeys', 'providerKeys', 'teamMembers'
 *
 * A limit of 0 means unlimited. If the user has no plan assigned, everything
 * is allowed (no restrictions).
 */
export async function checkPlanLimit(
  userId: string,
  resource: 'platformKeys' | 'providerKeys' | 'teamMembers'
): Promise<PlanLimitResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { planId: true },
  })

  if (!user?.planId) {
    // No plan assigned — allow everything
    return { allowed: true, current: 0, limit: 0 }
  }

  const plan = await prisma.plan.findUnique({
    where: { id: user.planId },
  })

  if (!plan) {
    return { allowed: true, current: 0, limit: 0 }
  }

  let current = 0
  let limit = 0

  switch (resource) {
    case 'platformKeys': {
      limit = plan.platformKeysLimit
      if (limit === 0) return { allowed: true, current: 0, limit: 0 }
      current = await prisma.platformKey.count({
        where: { userId },
      })
      break
    }
    case 'providerKeys': {
      limit = plan.providerKeysLimit
      if (limit === 0) return { allowed: true, current: 0, limit: 0 }
      current = await prisma.providerKey.count({
        where: { userId },
      })
      break
    }
    case 'teamMembers': {
      limit = plan.teamMembersLimit
      if (limit === 0) return { allowed: true, current: 0, limit: 0 }
      // Count total org memberships across all orgs the user owns
      const ownedOrgs = await prisma.organizationMember.findMany({
        where: { userId, role: 'OWNER' },
        select: { orgId: true },
      })
      if (ownedOrgs.length === 0) return { allowed: true, current: 0, limit }
      current = await prisma.organizationMember.count({
        where: { orgId: { in: ownedOrgs.map((o) => o.orgId) } },
      })
      break
    }
  }

  return {
    allowed: current < limit,
    current,
    limit,
  }
}
