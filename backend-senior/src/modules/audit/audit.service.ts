import { prisma } from '../../lib/prisma';

export interface AuditParams {
  companyId?: string;
  userId?: string;
  userEmail?: string;
  entity?: string;
  entityId?: string;
  action: string;
  before?: unknown;
  after?: unknown;
  detail?: string;
  ip?: string;
  userAgent?: string;
}

export async function audit(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        companyId: params.companyId,
        userId: params.userId,
        userEmail: params.userEmail,
        entity: params.entity,
        entityId: params.entityId,
        action: params.action,
        before: params.before !== undefined ? (params.before as object) : undefined,
        after: params.after !== undefined ? (params.after as object) : undefined,
        detail: params.detail,
        ip: params.ip,
        userAgent: params.userAgent,
      },
    });
  } catch (err) {
    // Falha de auditoria nunca derruba a requisição.
    // Em produção, considere enviar para um serviço de log secundário.
    console.error('[audit] falha ao registrar evento:', err);
  }
}

export interface AuditListParams {
  companyId: string;
  entity?: string;
  entityId?: string;
  userId?: string;
  action?: string;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

export class AuditService {
  async list(params: AuditListParams) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(params.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { companyId: params.companyId };
    if (params.entity) where.entity = params.entity;
    if (params.entityId) where.entityId = params.entityId;
    if (params.userId) where.userId = params.userId;
    if (params.action) where.action = { contains: params.action, mode: 'insensitive' };
    if (params.from || params.to) {
      where.createdAt = {};
      if (params.from) (where.createdAt as Record<string, unknown>).gte = params.from;
      if (params.to) (where.createdAt as Record<string, unknown>).lte = params.to;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { data: logs, total, page, totalPages: Math.ceil(total / limit) };
  }
}
