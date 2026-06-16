import { prisma } from './prisma';

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
  } catch {
    // Falha de auditoria nunca derruba a requisicao.
  }
}
