import { Prisma, OrderStatus, Priority } from '@prisma/client';
import { prisma, TxClient } from '../../lib/prisma';
import { audit } from '../audit/audit.service';
import { StockService } from '../stock/stock.service';
import {
  NotFoundError, AppError, ConcurrencyError, ForbiddenError,
} from '../../shared/errors';
import { parsePagination, buildPaginatedResult } from '../../shared/pagination';
import {
  canTransition,
  CreateServiceOrderInput,
  UpdateStatusInput,
  UpdateExecutionInput,
  AssignInput,
} from './service-order.rules';

const stockService = new StockService();

interface RequestUser {
  id: string;
  role: string;
  companyId: string;
}

export class ServiceOrderService {
  // ─── CREATE ──────────────────────────────────────────────────────────────────

  async create(data: CreateServiceOrderInput, user: RequestUser) {
    return prisma.$transaction(async (tx) => {
      const client = await tx.client.findFirst({
        where: { id: data.clientId, companyId: user.companyId },
      });
      if (!client) throw new NotFoundError('Cliente');
      if (client.isBlocked) throw new AppError('Cliente bloqueado: ' + (client.blockedReason ?? ''), 422);

      const activeOS = await tx.serviceOrder.count({
        where: {
          clientId: data.clientId,
          companyId: user.companyId,
          status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_PARTS'] },
        },
      });
      if (activeOS >= 3) throw new AppError('Cliente já possui 3 OS em andamento (máximo permitido)', 422);

      const dueDate = new Date(data.dueDate);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      if (dueDate < tomorrow) {
        throw new AppError('Prazo deve ser no mínimo amanhã', 422);
      }

      if (data.technicianId) {
        await this._validateTechnicianCapacity(tx, data.technicianId, user.companyId);
      }

      if (data.teamId) {
        const team = await tx.team.findFirst({ where: { id: data.teamId, companyId: user.companyId } });
        if (!team) throw new NotFoundError('Equipe');
      }

      // Número sequencial por empresa com lock
      const [{ nextNum }] = await tx.$queryRaw<Array<{ nextNum: number }>>`
        SELECT COALESCE(MAX(number), 0) + 1 AS "nextNum"
        FROM "ServiceOrder"
        WHERE "companyId" = ${user.companyId}
      `;

      const items = data.items.map((item) => ({
        ...item,
        discount: new Prisma.Decimal(item.discount ?? 0),
        unitPrice: new Prisma.Decimal(item.unitPrice),
        total: new Prisma.Decimal((item.quantity * item.unitPrice) - (item.discount ?? 0)),
      }));

      const total = items.reduce((sum, i) => sum + Number(i.total), 0);

      const os = await tx.serviceOrder.create({
        data: {
          companyId: user.companyId,
          number: nextNum,
          clientId: data.clientId,
          technicianId: data.technicianId,
          teamId: data.teamId,
          dueDate,
          totalAmount: new Prisma.Decimal(total),
          description: data.description,
          internalNotes: data.internalNotes,
          priority: (data.priority as Priority) ?? 'NORMAL',
          chipIccid: data.chipIccid,
          createdById: user.id,
          scheduledStart: data.scheduledStart ? new Date(data.scheduledStart) : undefined,
          scheduledEnd: data.scheduledEnd ? new Date(data.scheduledEnd) : undefined,
          items: items.length > 0 ? { create: items } : undefined,
        },
        include: { client: true, technician: true, team: true, items: true },
      });

      if (data.schedule) {
        await tx.serviceOrderSchedule.create({
          data: {
            serviceOrderId: os.id,
            scheduledDate: new Date(data.schedule.scheduledDate),
            scheduledTime: data.schedule.scheduledTime,
            estimatedHours: data.schedule.estimatedHours
              ? new Prisma.Decimal(data.schedule.estimatedHours)
              : undefined,
            notes: data.schedule.notes,
          },
        });
      }

      await tx.serviceOrderHistory.create({
        data: {
          serviceOrderId: os.id,
          userId: user.id,
          action: 'OS_CRIADA',
          toStatus: 'OPEN',
          after: { number: os.number, clientId: os.clientId, totalAmount: total },
        },
      });

      await audit({
        companyId: user.companyId,
        userId: user.id,
        entity: 'ServiceOrder',
        entityId: os.id,
        action: 'OS_CRIADA',
        after: { number: os.number, status: 'OPEN', total },
      });

      return os;
    });
  }

  // ─── UPDATE STATUS ────────────────────────────────────────────────────────────

  async updateStatus(id: string, input: UpdateStatusInput, user: RequestUser) {
    return prisma.$transaction(async (tx) => {
      const os = await tx.serviceOrder.findFirst({
        where: { id, companyId: user.companyId },
        include: { invoices: { include: { payments: true } } },
      });
      if (!os) throw new NotFoundError('OS');

      if (user.role === 'TECHNICIAN') {
        const tech = await tx.technician.findFirst({ where: { userId: user.id } });
        if (!tech || os.technicianId !== tech.id) throw new ForbiddenError('Técnico não autorizado para esta OS');
      }

      if (!canTransition(os.status, input.status)) {
        throw new AppError(`Transição inválida: ${os.status} → ${input.status}`, 422);
      }

      if (input.status === 'CANCELLED' && !input.cancellationReason) {
        throw new AppError('Motivo do cancelamento é obrigatório', 422);
      }

      if (input.status === 'COMPLETED') {
        const execution = await tx.serviceOrderExecution.findUnique({ where: { serviceOrderId: id } });

        // 1. Checkin obrigatório
        if (!execution?.checkinAt) {
          throw new AppError('OS não pode ser concluída: check-in não realizado', 422);
        }

        // 2. Mínimo 3 fotos (novo contrato: attachmentIds; fallback: photoUrls legado)
        const photoCount = (execution.photoAttachmentIds?.length ?? 0) > 0
          ? (execution.photoAttachmentIds?.length ?? 0)
          : (execution.photoUrls?.length ?? 0);
        if (photoCount < 3) {
          throw new AppError(`OS não pode ser concluída: ${photoCount}/3 fotos registradas`, 422);
        }

        // 3. Assinatura obrigatória
        const hasSignature = execution.signatureAttachmentId || execution.clientSignature;
        if (!hasSignature) {
          throw new AppError('OS não pode ser concluída: assinatura do cliente não coletada', 422);
        }

        const totalPaid = os.invoices
          .flatMap((inv) => inv.payments)
          .filter((p) => p.status === 'PAID')
          .reduce((sum, p) => sum + Number(p.netAmount), 0);
        if (totalPaid < Number(os.totalAmount) && Number(os.totalAmount) > 0) {
          throw new AppError('OS não pode ser concluída: pagamento pendente', 422);
        }
      }

      // Optimistic lock: garante que ninguém alterou a OS entre a leitura e o update
      const result = await tx.serviceOrder.updateMany({
        where: { id, companyId: user.companyId, version: os.version },
        data: {
          status: input.status,
          completionDate: input.status === 'COMPLETED' ? new Date() : undefined,
          startDate: input.status === 'IN_PROGRESS' && !os.startDate ? new Date() : undefined,
          cancellationReason: input.status === 'CANCELLED' ? input.cancellationReason : undefined,
          version: { increment: 1 },
        },
      });

      if (result.count === 0) throw new ConcurrencyError();

      await tx.serviceOrderHistory.create({
        data: {
          serviceOrderId: id,
          userId: user.id,
          action: `STATUS_${input.status}`,
          fromStatus: os.status,
          toStatus: input.status,
          note: input.note ?? input.cancellationReason,
          before: { status: os.status, version: os.version },
          after: { status: input.status, version: os.version + 1 },
        },
      });

      await tx.serviceOrderEvent.create({
        data: {
          serviceOrderId: id,
          eventType: 'STATUS_CHANGE',
          description: `Status alterado: ${os.status} → ${input.status}`,
          userId: user.id,
          metadata: { from: os.status, to: input.status, note: input.note },
        },
      });

      // Liberar reservas de estoque ao cancelar
      if (input.status === 'CANCELLED') {
        await tx.stockReservation.updateMany({
          where: { serviceOrderId: id, status: 'ACTIVE' },
          data: { status: 'RELEASED', releasedAt: new Date() },
        });
      }

      // Consumir reservas ao concluir
      if (input.status === 'COMPLETED') {
        await stockService.consumeReservation(id, user.id);
      }

      await audit({
        companyId: user.companyId,
        userId: user.id,
        entity: 'ServiceOrder',
        entityId: id,
        action: `STATUS_${input.status}`,
        before: { status: os.status },
        after: { status: input.status },
      });

      return tx.serviceOrder.findFirst({
        where: { id },
        include: { client: true, technician: true, team: true, items: true },
      });
    });
  }

  // ─── ASSIGN ───────────────────────────────────────────────────────────────────

  async assign(id: string, input: AssignInput, user: RequestUser) {
    return prisma.$transaction(async (tx) => {
      const os = await tx.serviceOrder.findFirst({ where: { id, companyId: user.companyId } });
      if (!os) throw new NotFoundError('OS');
      if (['COMPLETED', 'CANCELLED'].includes(os.status)) {
        throw new AppError('Não é possível reatribuir uma OS finalizada ou cancelada', 422);
      }

      if (input.technicianId) {
        await this._validateTechnicianCapacity(tx, input.technicianId, user.companyId, id);
      }

      if (input.teamId !== undefined) {
        if (input.teamId !== null) {
          const team = await tx.team.findFirst({ where: { id: input.teamId, companyId: user.companyId } });
          if (!team) throw new NotFoundError('Equipe');
        }
      }

      const before = { technicianId: os.technicianId, teamId: os.teamId, version: os.version };

      const result = await tx.serviceOrder.updateMany({
        where: { id, companyId: user.companyId, version: os.version },
        data: {
          technicianId: input.technicianId !== undefined ? input.technicianId : os.technicianId,
          teamId: input.teamId !== undefined ? input.teamId : os.teamId,
          version: { increment: 1 },
        },
      });

      if (result.count === 0) throw new ConcurrencyError();

      await tx.serviceOrderHistory.create({
        data: {
          serviceOrderId: id,
          userId: user.id,
          action: 'OS_ATRIBUIDA',
          before,
          after: { technicianId: input.technicianId, teamId: input.teamId },
        },
      });

      await audit({ companyId: user.companyId, userId: user.id, entity: 'ServiceOrder', entityId: id, action: 'OS_ATRIBUIDA', before, after: input });

      return tx.serviceOrder.findFirst({
        where: { id },
        include: { client: true, technician: true, team: true },
      });
    });
  }

  // ─── UPDATE EXECUTION ─────────────────────────────────────────────────────────

  async updateExecution(id: string, data: UpdateExecutionInput, user: RequestUser) {
    return prisma.$transaction(async (tx) => {
      const os = await tx.serviceOrder.findFirst({ where: { id, companyId: user.companyId } });
      if (!os) throw new NotFoundError('OS');
      if (['COMPLETED', 'CANCELLED'].includes(os.status)) {
        throw new AppError('OS finalizada ou cancelada', 422);
      }

      if (user.role === 'TECHNICIAN') {
        const tech = await tx.technician.findFirst({ where: { userId: user.id } });
        if (!tech || os.technicianId !== tech.id) throw new ForbiddenError('Técnico não autorizado para esta OS');
      }

      // Upsert execution record
      const execData: Record<string, unknown> = {};
      if (data.checkinAt !== undefined) execData.checkinAt = new Date(data.checkinAt);
      if (data.checkoutAt !== undefined) execData.checkoutAt = new Date(data.checkoutAt);
      if (data.checkinLocation !== undefined) execData.checkinLocation = data.checkinLocation;
      if (data.checkinLat !== undefined) execData.checkinLat = new Prisma.Decimal(data.checkinLat);
      if (data.checkinLng !== undefined) execData.checkinLng = new Prisma.Decimal(data.checkinLng);
      if (data.checkoutLat !== undefined) execData.checkoutLat = new Prisma.Decimal(data.checkoutLat);
      if (data.checkoutLng !== undefined) execData.checkoutLng = new Prisma.Decimal(data.checkoutLng);
      if (data.workDoneNotes !== undefined) execData.workDoneNotes = data.workDoneNotes;
      if (data.photoUrls !== undefined) execData.photoUrls = data.photoUrls;
      if (data.clientSignature !== undefined) execData.clientSignature = data.clientSignature;
      if (data.photoAttachmentIds !== undefined) execData.photoAttachmentIds = data.photoAttachmentIds;
      if (data.signatureAttachmentId !== undefined) execData.signatureAttachmentId = data.signatureAttachmentId;

      await tx.serviceOrderExecution.upsert({
        where: { serviceOrderId: id },
        create: { serviceOrderId: id, ...execData },
        update: execData,
      });

      if (data.chipIccid !== undefined) {
        await tx.serviceOrder.update({ where: { id }, data: { chipIccid: data.chipIccid } });
      }

      await tx.serviceOrderEvent.create({
        data: {
          serviceOrderId: id,
          eventType: 'EXECUTION_UPDATE',
          description: 'Dados de execução atualizados',
          userId: user.id,
          metadata: execData as Prisma.InputJsonValue,
        },
      });

      await audit({
        companyId: user.companyId, userId: user.id,
        entity: 'ServiceOrder', entityId: id,
        action: 'EXECUTION_UPDATED', after: execData,
      });

      return tx.serviceOrder.findFirst({
        where: { id },
        include: { execution: true, client: true, technician: true },
      });
    });
  }

  // ─── SCOPE HELPER — garante isolamento por role e companyId ─────────────────

  private async buildScopeWhere(user: RequestUser): Promise<Prisma.ServiceOrderWhereInput> {
    // Todos os roles não-técnico vêem todas as OS da empresa
    if (user.role !== 'TECHNICIAN') {
      return { companyId: user.companyId };
    }

    // Técnico vê somente OS onde technicianId aponta para o Technician vinculado a este user
    const tech = await prisma.technician.findFirst({ where: { userId: user.id, companyId: user.companyId } });
    if (!tech) {
      // Técnico sem registro Technician — onde impossível garante lista vazia
      return { companyId: user.companyId, id: 'impossible-scope-no-technician-record' };
    }

    return { companyId: user.companyId, technicianId: tech.id };
  }

  // ─── LIST ─────────────────────────────────────────────────────────────────────

  async list(params: {
    companyId: string;
    status?: OrderStatus;
    priority?: Priority;
    teamId?: string;
    technicianId?: string;
    clientId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }, user: RequestUser) {
    const { page, limit, skip } = parsePagination(params);

    const scopeWhere = await this.buildScopeWhere(user);
    const where: Prisma.ServiceOrderWhereInput = { ...scopeWhere };

    if (params.status) where.status = params.status;
    if (params.priority) where.priority = params.priority;
    // Técnico não pode filtrar por technicianId de outro técnico
    if (params.teamId) where.teamId = params.teamId;
    if (params.technicianId && user.role !== 'TECHNICIAN') where.technicianId = params.technicianId;
    if (params.clientId) where.clientId = params.clientId;
    if (params.search) {
      where.OR = [
        { description: { contains: params.search, mode: 'insensitive' } },
        { client: { name: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.serviceOrder.findMany({
        where,
        skip,
        take: limit,
        include: {
          client: { select: { id: true, name: true, document: true, phone: true, address: true, city: true, state: true } },
          technician: { select: { id: true, name: true } },
          team: { select: { id: true, name: true } },
          execution: { select: { checkinAt: true, checkoutAt: true, checkinLat: true, checkinLng: true, photoUrls: true, clientSignature: true, photoAttachmentIds: true, signatureAttachmentId: true } },
          _count: { select: { items: true, attachments: true } },
        },
        orderBy: [{ priority: 'desc' }, { openingDate: 'desc' }],
      }),
      prisma.serviceOrder.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findById(id: string, user: RequestUser) {
    const scopeWhere = await this.buildScopeWhere(user);
    const os = await prisma.serviceOrder.findFirst({
      where: { ...scopeWhere, id },
      include: {
        client: true,
        technician: true,
        team: true,
        items: { include: { product: { select: { id: true, name: true, sku: true } } } },
        schedule: true,
        execution: true,
        history: { orderBy: { createdAt: 'asc' } },
        events: { orderBy: { createdAt: 'asc' } },
        attachments: { where: { deletedAt: null } },
        materialRequests: { include: { product: { select: { id: true, name: true } } } },
        invoices: { include: { payments: true } },
      },
    });
    // Sempre 404 para evitar enumeração — não revela se existe mas é de outro técnico
    if (!os) throw new NotFoundError('OS');
    return os;
  }

  // Soft delete — nunca deleta OS concluídas
  async delete(id: string, user: RequestUser) {
    const scopeWhere = await this.buildScopeWhere(user);
    const os = await prisma.serviceOrder.findFirst({ where: { ...scopeWhere, id } });
    if (!os) throw new NotFoundError('OS');
    if (os.status === 'COMPLETED') throw new AppError('Não é possível excluir uma OS concluída', 422);
    if (os.status === 'IN_PROGRESS') throw new AppError('Cancele a OS antes de excluir', 422);

    await prisma.serviceOrder.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: user.id },
    });

    await audit({ companyId: user.companyId, userId: user.id, entity: 'ServiceOrder', entityId: id, action: 'OS_EXCLUIDA', before: { status: os.status, number: os.number } });
    return { success: true };
  }

  // ─── PRIVATE HELPERS ──────────────────────────────────────────────────────────

  private async _validateTechnicianCapacity(
    tx: TxClient,
    technicianId: string,
    companyId: string,
    excludeOsId?: string,
  ) {
    const technician = await tx.technician.findFirst({
      where: { id: technicianId, companyId },
    });
    if (!technician) throw new NotFoundError('Técnico');
    if (!technician.isActive) throw new AppError('Técnico inativo', 422);

    const where: Prisma.ServiceOrderWhereInput = {
      technicianId,
      status: 'IN_PROGRESS',
    };
    if (excludeOsId) where.id = { not: excludeOsId };

    const activeCount = await tx.serviceOrder.count({ where });
    if (activeCount >= technician.maxConcurrentOS) {
      throw new AppError(`Técnico excedeu limite de ${technician.maxConcurrentOS} OS simultâneas`, 422);
    }
  }
}
