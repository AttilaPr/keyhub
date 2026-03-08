import prisma from '@/lib/prisma'

interface AuditLogParams {
  actorId: string
  userId?: string
  action: string
  targetType?: string
  targetId?: string
  metadata?: Record<string, unknown>
  ip?: string | null
  userAgent?: string | null
}

export async function logAuditEvent(params: AuditLogParams) {
  await prisma.auditEvent.create({
    data: {
      actorId: params.actorId,
      userId: params.userId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      ip: params.ip ?? null,
      userAgent: params.userAgent ?? null,
    },
  })
}

export function getRequestMeta(req: Request) {
  return {
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: req.headers.get('user-agent') ?? null,
  }
}
