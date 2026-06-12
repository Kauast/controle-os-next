import { AttachmentEntityType, AttachmentKind, AuditAction, InvoiceStatus, PaymentStatus, Priority, Status, ServiceOrderEventType } from '@prisma/client';
import dayjs from 'dayjs';
import { ChipService } from './chipService';
import {
  canTransition,
  createOSSchema,
  CreateOSInput,
  UpdateExecutionInput,
  updateExecutionSchema,
} from '../lib/serviceOrderRules';
import { prisma, PrismaTransaction } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { RequestContext } from '../shared/context/requestContext';
import { audit } from '../lib/audit';
import { StockService } from '../modules/stock/application/stockService';

export { createOSSchema, updateExecutionSchema, canTransition, type CreateOSInput };

const stockService = new StockService();

function parseScheduledDate(dueDate: string, scheduledTime?: string) {
  if (!scheduledTime) return new Date(dueDate);
  const [hour, minute] = scheduledTime.split(':').map(Number);
  return dayjs(dueDate).hour(hour).minute(minute).second(0).millisecond(0).toDate();
}

async function createHistory(tx: PrismaTransaction, params: {
  tenantId: string;
  serviceOrderId: string;
  field: string;
  action: AuditAction;
  before?: unknown;
  after?: unknown;
}) {
  await tx.serviceOrderHistory.create({
    data: {
      tenantId: params.tenantId,
      serviceOrderId: params.serviceOrderId,
      field: params.field,
      action: params.action,
      before: params.before as never,
      after: params.after as never,
      changedById: RequestContext.get().userId,
    },
  });
}

async function createEvent(tx: PrismaTransaction, params: {
  tenantId: string;
  serviceOrderId: string;
  type: ServiceOrderEventType;
  description: string;
  metadata?: unknown;
}) {
  await tx.serviceOrderEvent.create({
    data: {
      tenantId: params.tenantId,
      serviceOrderId: params.serviceOrderId,
      type: params.type,
      description: params.description,
      metadata: params.metadata as never,
      createdById: RequestContext.get().userId,
    },
  });
}

export class ServiceOrderService {
  async create(data: CreateOSInput, createdById?: string) {
    const tenantId = RequestContext.get().tenantId;
    if (!tenantId) throw new AppError('Tenant não resolvido', 400);

    return prisma.$transaction(async (tx) => {
      const client = await tx.client.findFirst({ where: { id: data.clientId, tenantId, deletedAt: null } });
      if (!client) throw new AppError('Cliente não encontrado', 404);
      if (client.isBlocked) throw new AppError('Cliente está bloqueado', 409);

      const activeOS = await tx.serviceOrder.count({
        where: {
          tenantId,
          clientId: data.clientId,
          deletedAt: null,
          status: { in: [Status.OPEN, Status.IN_PROGRESS, Status.WAITING_PARTS] },
        },
      });
      if (activeOS >= 10) throw new AppError('Cliente já possui muitas OS em andamento simultaneamente', 409);

      const dueDate = new Date(data.dueDate);
      if (dueDate < dayjs().startOf('day').toDate()) {
        throw new AppError('Prazo deve ser no mínimo hoje', 400);
      }

      let technician = null;
      if (data.technicianId) {
        technician = await tx.technician.findFirst({
          where: { id: data.technicianId, tenantId, deletedAt: null },
          include: {
            serviceOrders: {
              where: { status: { in: [Status.OPEN, Status.IN_PROGRESS, Status.WAITING_PARTS] }, deletedAt: null },
            },
          },
        });
        if (!technician) throw new AppError('Técnico não encontrado', 404);
        if (!technician.isActive) throw new AppError('Técnico inativo', 409);
        if (technician.serviceOrders.length >= technician.maxConcurrentOS) {
          throw new AppError('Técnico excedeu o limite de OS simultâneas', 409);
        }
      }

      const total = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

      const serviceOrder = await tx.serviceOrder.create({
        data: {
          tenantId,
          clientId: data.clientId,
          technicianId: data.technicianId,
          teamId: technician?.teamId ?? null,
          dueDate,
          totalAmount: total,
          description: data.description,
          team: technician?.team || data.team || 'Sem equipe',
          priority: (data.priority as Priority) ?? Priority.NORMAL,
          scheduledTime: data.scheduledTime,
          createdById: createdById ?? RequestContext.get().userId ?? null,
          updatedById: createdById ?? RequestContext.get().userId ?? null,
          items: data.items.length > 0 ? {
            create: data.items.map((item) => ({
              tenantId,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              itemType: item.itemType,
              productId: item.productId,
            })),
          } : undefined,
        },
        include: { client: true, technician: true, items: true },
      });

      await tx.invoice.create({
        data: {
          tenantId,
          clientId: serviceOrder.clientId,
          serviceOrderId: serviceOrder.id,
          status: total > 0 ? InvoiceStatus.OPEN : InvoiceStatus.PAID,
          dueDate,
          subtotal: total,
          totalAmount: total,
          balanceAmount: total,
        },
      });

      if (data.scheduledTime) {
        await tx.serviceOrderSchedule.create({
          data: {
            tenantId,
            serviceOrderId: serviceOrder.id,
            technicianId: serviceOrder.technicianId,
            teamId: serviceOrder.teamId,
            scheduledStart: parseScheduledDate(data.dueDate, data.scheduledTime),
            isCurrent: true,
            createdById: createdById ?? RequestContext.get().userId,
          },
        });
      }

      await createHistory(tx, {
        tenantId,
        serviceOrderId: serviceOrder.id,
        field: 'serviceOrder',
        action: AuditAction.INSERT,
        after: serviceOrder,
      });
      await createEvent(tx, {
        tenantId,
        serviceOrderId: serviceOrder.id,
        type: ServiceOrderEventType.CREATED,
        description: 'Ordem de serviço criada',
      });
      await audit({
        tenantId,
        entity: 'ServiceOrder',
        entityId: serviceOrder.id,
        action: AuditAction.INSERT,
        after: serviceOrder,
      });

      return serviceOrder;
    });
  }

  async updateStatus(
    id: string,
    newStatus: Status,
    cancellationReason?: string,
    requester?: { id: string; role: string }
  ) {
    const tenantId = RequestContext.get().tenantId;
    if (!tenantId) throw new AppError('Tenant não resolvido', 400);

    return prisma.$transaction(async (tx) => {
      const os = await tx.serviceOrder.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: {
          payments: { where: { deletedAt: null } },
          invoices: { where: { deletedAt: null } },
          stockReservations: {
            where: { deletedAt: null },
          },
        },
      });
      if (!os) throw new AppError('OS não encontrada', 404);

      if (requester?.role === 'TECHNICIAN') {
        const technician = await tx.technician.findFirst({ where: { userId: requester.id, tenantId, deletedAt: null } });
        if (!technician || os.technicianId !== technician.id) {
          throw new AppError('Técnico não autorizado para esta OS', 403);
        }
      }

      if (!canTransition(os.status, newStatus)) {
        throw new AppError(`Transição inválida: ${os.status} → ${newStatus}`, 409);
      }

      if (newStatus === Status.CANCELLED && !cancellationReason) {
        throw new AppError('Motivo do cancelamento é obrigatório', 400);
      }

      if (newStatus === Status.COMPLETED) {
        const outstandingInvoice = os.invoices.find((invoice) => Number(invoice.balanceAmount) > 0);
        if (outstandingInvoice) {
          throw new AppError('OS não pode ser concluída: cobrança em aberto', 409);
        }
      }

      const result = await tx.serviceOrder.updateMany({
        where: { id, tenantId, version: os.version, deletedAt: null },
        data: {
          status: newStatus,
          completionDate: newStatus === Status.COMPLETED ? new Date() : undefined,
          startDate: newStatus === Status.IN_PROGRESS && !os.startDate ? new Date() : undefined,
          cancellationReason: newStatus === Status.CANCELLED ? cancellationReason : undefined,
          updatedById: RequestContext.get().userId,
          version: { increment: 1 },
        },
      });

      if (result.count === 0) {
        throw new AppError('Conflito de concorrência. Tente novamente.', 409);
      }

      if (newStatus === Status.COMPLETED) {
        for (const reservation of os.stockReservations) {
          if (reservation.status === 'RESERVED') {
            await stockService.consumeReservation(reservation.id, undefined, tx);
          }
        }
      }

      if (newStatus === Status.CANCELLED) {
        for (const reservation of os.stockReservations) {
          if (reservation.status === 'RESERVED') {
            await stockService.releaseReservation(reservation.id, tx);
          }
        }
      }

      const finalOS = await tx.serviceOrder.findFirst({ where: { id, tenantId } });
      if (!finalOS) throw new AppError('OS não encontrada após atualização', 404);

      if (newStatus === Status.COMPLETED && os.chipId) {
        const chipService = new ChipService();
        await chipService.createFromOS(os.chipId, os.clientId, os.id);
      }

      await createHistory(tx, {
        tenantId,
        serviceOrderId: os.id,
        field: 'status',
        action: AuditAction.UPDATE,
        before: { status: os.status },
        after: { status: newStatus },
      });
      await createEvent(tx, {
        tenantId,
        serviceOrderId: os.id,
        type: newStatus === Status.COMPLETED ? ServiceOrderEventType.COMPLETED : newStatus === Status.CANCELLED ? ServiceOrderEventType.CANCELLED : ServiceOrderEventType.STATUS_CHANGED,
        description: `Status alterado para ${newStatus}`,
      });
      await audit({
        tenantId,
        entity: 'ServiceOrder',
        entityId: os.id,
        action: AuditAction.UPDATE,
        before: { status: os.status },
        after: { status: newStatus },
      });

      return finalOS;
    });
  }

  async assign(id: string, team: string, technicianId?: string | null) {
    const tenantId = RequestContext.get().tenantId;
    if (!tenantId) throw new AppError('Tenant não resolvido', 400);

    return prisma.$transaction(async (tx) => {
      const os = await tx.serviceOrder.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!os) throw new AppError('OS não encontrada', 404);
      if (os.status === Status.COMPLETED || os.status === Status.CANCELLED) {
        throw new AppError('Não é possível reatribuir uma OS finalizada ou cancelada', 409);
      }

      let technician = null;
      if (technicianId) {
        technician = await tx.technician.findFirst({
          where: { id: technicianId, tenantId, deletedAt: null },
          include: {
            serviceOrders: {
              where: { status: { in: [Status.OPEN, Status.IN_PROGRESS, Status.WAITING_PARTS] }, deletedAt: null },
            },
          },
        });
        if (!technician) throw new AppError('Técnico não encontrado', 404);
        if (!technician.isActive) throw new AppError('Técnico inativo', 409);
        if (technician.serviceOrders.length >= technician.maxConcurrentOS) {
          throw new AppError('Técnico excedeu limite de OS simultâneas', 409);
        }
      }

      const updated = await tx.serviceOrder.updateMany({
        where: { id: os.id, tenantId, version: os.version, deletedAt: null },
        data: {
          team,
          teamId: technician?.teamId ?? os.teamId,
          technicianId: technicianId === null ? null : (technicianId ?? os.technicianId),
          updatedById: RequestContext.get().userId,
          version: { increment: 1 },
        },
      });

      if (updated.count === 0) {
        throw new AppError('Conflito de concorrência ao atribuir OS', 409);
      }

      await tx.serviceOrderSchedule.updateMany({
        where: { serviceOrderId: os.id, tenantId, isCurrent: true, deletedAt: null },
        data: { isCurrent: false, version: { increment: 1 } },
      });

      await tx.serviceOrderSchedule.create({
        data: {
          tenantId,
          serviceOrderId: os.id,
          technicianId: technicianId === null ? null : technicianId ?? os.technicianId,
          teamId: technician?.teamId ?? os.teamId,
          scheduledStart: parseScheduledDate(os.dueDate.toISOString(), os.scheduledTime ?? undefined),
          isCurrent: true,
          createdById: RequestContext.get().userId,
        },
      });

      await createHistory(tx, {
        tenantId,
        serviceOrderId: os.id,
        field: 'assignment',
        action: AuditAction.UPDATE,
        before: { team: os.team, technicianId: os.technicianId },
        after: { team, technicianId: technicianId ?? os.technicianId },
      });
      await createEvent(tx, {
        tenantId,
        serviceOrderId: os.id,
        type: ServiceOrderEventType.ASSIGNED,
        description: 'OS atribuída/reatribuída',
        metadata: { team, technicianId },
      });

      return tx.serviceOrder.findFirst({
        where: { id: os.id, tenantId },
        include: { client: true, technician: true },
      });
    });
  }

  async updateExecution(id: string, data: UpdateExecutionInput) {
    const tenantId = RequestContext.get().tenantId;
    if (!tenantId) throw new AppError('Tenant não resolvido', 400);

    return prisma.$transaction(async (tx) => {
      const os = await tx.serviceOrder.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!os) throw new AppError('OS não encontrada', 404);
      if (os.status === Status.COMPLETED) throw new AppError('Não é possível atualizar execução de uma OS já concluída', 409);
      if (os.status === Status.CANCELLED) throw new AppError('Não é possível atualizar execução de uma OS cancelada', 409);

      const updateData: Record<string, unknown> = {};
      if (data.checkinAt !== undefined) updateData.checkinAt = new Date(data.checkinAt);
      if (data.checkoutAt !== undefined) updateData.checkoutAt = new Date(data.checkoutAt);
      if (data.checkinLocation !== undefined) updateData.checkinLocation = data.checkinLocation;
      if (data.photoUrls !== undefined) updateData.photoUrls = data.photoUrls;
      if (data.clientSignature !== undefined) updateData.clientSignature = data.clientSignature;
      if (data.chipId !== undefined) updateData.chipId = data.chipId;

      const updated = await tx.serviceOrder.updateMany({
        where: { id: os.id, tenantId, version: os.version, deletedAt: null },
        data: {
          ...updateData,
          updatedById: RequestContext.get().userId,
          version: { increment: 1 },
        },
      });

      if (updated.count === 0) {
        throw new AppError('Conflito de concorrência ao atualizar execução', 409);
      }

      await tx.serviceOrderExecution.create({
        data: {
          tenantId,
          serviceOrderId: os.id,
          checkinAt: data.checkinAt ? new Date(data.checkinAt) : undefined,
          checkoutAt: data.checkoutAt ? new Date(data.checkoutAt) : undefined,
          checkinLocation: data.checkinLocation,
          notes: data.chipId ? `Chip informado: ${data.chipId}` : undefined,
          performedById: RequestContext.get().userId,
        },
      });

      if (data.photoUrls?.length) {
        for (const photoUrl of data.photoUrls) {
          const attachment = await tx.attachment.create({
            data: {
              tenantId,
              entityType: AttachmentEntityType.SERVICE_ORDER_EXECUTION,
              entityId: os.id,
              kind: AttachmentKind.PHOTO,
              fileName: photoUrl.split('/').pop() ?? 'foto',
              mimeType: 'image/jpeg',
              fileSize: 0,
              storageProvider: 'local',
              storagePath: photoUrl,
              hash: photoUrl,
              createdById: RequestContext.get().userId,
            },
          });

          await tx.serviceOrderAttachment.create({
            data: {
              tenantId,
              serviceOrderId: os.id,
              attachmentId: attachment.id,
            },
          });
        }
      }

      if (data.clientSignature) {
        const signature = await tx.attachment.create({
          data: {
            tenantId,
            entityType: AttachmentEntityType.SERVICE_ORDER_EXECUTION,
            entityId: os.id,
            kind: AttachmentKind.SIGNATURE,
            fileName: 'assinatura-cliente',
            mimeType: 'image/png',
            fileSize: 0,
            storageProvider: 'inline',
            storagePath: data.clientSignature,
            hash: data.clientSignature,
            createdById: RequestContext.get().userId,
          },
        });

        await tx.serviceOrderAttachment.create({
          data: {
            tenantId,
            serviceOrderId: os.id,
            attachmentId: signature.id,
          },
        });
      }

      await createHistory(tx, {
        tenantId,
        serviceOrderId: os.id,
        field: 'execution',
        action: AuditAction.UPDATE,
        before: {
          checkinAt: os.checkinAt,
          checkoutAt: os.checkoutAt,
          checkinLocation: os.checkinLocation,
        },
        after: updateData,
      });
      await createEvent(tx, {
        tenantId,
        serviceOrderId: os.id,
        type: data.checkoutAt ? ServiceOrderEventType.CHECKOUT : ServiceOrderEventType.CHECKIN,
        description: data.checkoutAt ? 'Checkout registrado' : 'Check-in atualizado',
      });

      return tx.serviceOrder.findFirst({
        where: { id: os.id, tenantId },
        include: { client: true, technician: true },
      });
    });
  }

  async list(filters: {
    status?: Status;
    priority?: Priority;
    team?: string;
    technicianId?: string;
    page?: number;
    limit?: number;
  }) {
    const tenantId = RequestContext.get().tenantId;
    if (!tenantId) throw new AppError('Tenant não resolvido', 400);

    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId, deletedAt: null };
    if (filters.status) where.status = filters.status;
    if (filters.team) where.team = filters.team;
    if (filters.technicianId) where.technicianId = filters.technicianId;
    if (filters.priority) where.priority = filters.priority;

    const [serviceOrders, total] = await Promise.all([
      prisma.serviceOrder.findMany({
        where,
        skip,
        take: limit,
        include: {
          client: true,
          technician: true,
          attachments: {
            include: { attachment: true },
          },
        },
        orderBy: [{ openingDate: 'desc' }],
      }),
      prisma.serviceOrder.count({ where }),
    ]);

    return {
      serviceOrders: serviceOrders.map((os) => ({
        ...os,
        photoUrls: os.attachments.filter((item) => item.attachment.kind === AttachmentKind.PHOTO).map((item) => item.attachment.storagePath),
        clientSignature: os.attachments.find((item) => item.attachment.kind === AttachmentKind.SIGNATURE)?.attachment.storagePath ?? os.clientSignature,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string) {
    const tenantId = RequestContext.get().tenantId;
    if (!tenantId) throw new AppError('Tenant não resolvido', 400);

    const os = await prisma.serviceOrder.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        client: true,
        technician: true,
        items: { include: { product: true } },
        payments: true,
        invoices: true,
        materialRequests: { include: { product: true } },
        schedules: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
        executions: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
        attachments: { include: { attachment: true } },
        histories: { orderBy: { createdAt: 'desc' }, take: 50 },
        events: { orderBy: { createdAt: 'desc' }, take: 100 },
      },
    });
    if (!os) throw new AppError('OS não encontrada', 404);

    return {
      ...os,
      photoUrls: os.attachments.filter((item) => item.attachment.kind === AttachmentKind.PHOTO).map((item) => item.attachment.storagePath),
      clientSignature: os.attachments.find((item) => item.attachment.kind === AttachmentKind.SIGNATURE)?.attachment.storagePath ?? os.clientSignature,
    };
  }

  async delete(id: string) {
    const tenantId = RequestContext.get().tenantId;
    if (!tenantId) throw new AppError('Tenant não resolvido', 400);

    const os = await prisma.serviceOrder.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!os) throw new AppError('OS não encontrada', 404);
    if (os.status === Status.COMPLETED) throw new AppError('Não é possível excluir uma OS concluída', 409);
    if (os.status === Status.IN_PROGRESS) throw new AppError('Não é possível excluir uma OS em andamento. Cancele-a primeiro', 409);

    await prisma.serviceOrder.delete({ where: { id: os.id } });

    await audit({
      tenantId,
      entity: 'ServiceOrder',
      entityId: os.id,
      action: AuditAction.SOFT_DELETE,
      before: os,
    });

    return { success: true };
  }
}
