import { AuditAction } from '@prisma/client';
import { prisma } from './prisma';
import { RequestContext } from '../shared/context/requestContext';

interface AuditParams {
  tenantId?: string;
  userId?: string;
  userEmail?: string;
  entity?: string;
  entityId?: string;
  action: AuditAction;
  detail?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
  userAgent?: string;
}

export async function audit(params: AuditParams) {
  const context = RequestContext.get();
  const tenantId = params.tenantId ?? context.tenantId;
  if (!tenantId) return;

  try {
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: params.userId ?? context.userId,
        userEmail: params.userEmail ?? context.userEmail,
        entity: params.entity,
        entityId: params.entityId,
        action: params.action,
        detail: params.detail,
        before: params.before as never,
        after: params.after as never,
        ip: params.ip ?? context.ip,
        userAgent: params.userAgent ?? context.userAgent,
      },
    });
  } catch {
    // Auditoria não deve derrubar a transação principal.
  }
}

