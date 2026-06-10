import { Priority, Status } from '@prisma/client';
import dayjs from 'dayjs';
import { ChipService } from './chipService';
import {
  canTransition,
  createOSSchema,
  CreateOSInput,
  UpdateExecutionInput,
  updateExecutionSchema,
} from '../lib/serviceOrderRules';
import { prisma } from '../lib/prisma';

export { createOSSchema, updateExecutionSchema, canTransition, type CreateOSInput };

export class ServiceOrderService {
  async create(data: CreateOSInput, createdById?: string) {
    return prisma.$transaction(async (tx) => {
      const client = await tx.client.findUnique({ where: { id: data.clientId } });
      if (!client) throw new Error('Cliente não encontrado');
      if (client.isBlocked) throw new Error('Cliente está bloqueado');

      const activeOS = await tx.serviceOrder.count({
        where: {
          clientId: data.clientId,
          status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_PARTS'] },
        },
      });
      if (activeOS >= 3) throw new Error('Cliente já possui 3 OS em andamento simultaneamente (limite máximo)');

      const dueDate = new Date(data.dueDate);
      if (dueDate < dayjs().startOf('day').toDate()) {
        throw new Error('Prazo deve ser no mínimo hoje');
      }

      if (data.technicianId) {
        const technician = await tx.technician.findUnique({
          where: { id: data.technicianId },
          include: { serviceOrders: { where: { status: 'IN_PROGRESS' } } },
        });
        if (!technician) throw new Error('Técnico não encontrado');
        if (!technician.isActive) throw new Error('Técnico inativo');
        if (technician.serviceOrders.length >= technician.maxConcurrentOS) {
          throw new Error('Técnico excedeu limite de OS simultâneas');
        }
      }

      const total = data.items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0
      );

      return tx.serviceOrder.create({
        data: {
          clientId: data.clientId,
          technicianId: data.technicianId,
          dueDate,
          totalAmount: total,
          description: data.description,
          team: data.team ?? 'Sem equipe',
          priority: (data.priority as Priority) ?? 'NORMAL',
          scheduledTime: data.scheduledTime,
          createdById: createdById ?? null,
          items: data.items.length > 0 ? { create: data.items } : undefined,
        },
        include: { client: true, technician: true, items: true },
      });
    });
  }

  async updateStatus(
    id: string,
    newStatus: Status,
    cancellationReason?: string,
    requester?: { id: string; role: string }
  ) {
    return prisma.$transaction(async (tx) => {
      const os = await tx.serviceOrder.findUnique({
        where: { id },
        include: { payments: true },
      });
      if (!os) throw new Error('OS não encontrada');

      if (requester?.role === 'TECHNICIAN') {
        const technician = await tx.technician.findUnique({ where: { userId: requester.id } });
        if (!technician || os.technicianId !== technician.id) {
          throw new Error('Técnico não autorizado para esta OS');
        }
      }

      if (!canTransition(os.status, newStatus)) {
        throw new Error(`Transição inválida: ${os.status} → ${newStatus}`);
      }

      if (newStatus === 'CANCELLED' && !cancellationReason) {
        throw new Error('Motivo do cancelamento é obrigatório');
      }

      if (newStatus === 'COMPLETED') {
        const totalPaid = os.payments.reduce((sum, p) => sum + Number(p.amount), 0);
        if (totalPaid < Number(os.totalAmount) && Number(os.totalAmount) > 0) {
          throw new Error('OS não pode ser concluída: pagamento pendente');
        }
      }

      const result = await tx.serviceOrder.updateMany({
        where: { id, version: os.version },
        data: {
          status: newStatus,
          completionDate: newStatus === 'COMPLETED' ? new Date() : undefined,
          startDate: newStatus === 'IN_PROGRESS' && !os.startDate ? new Date() : undefined,
          cancellationReason: newStatus === 'CANCELLED' ? cancellationReason : undefined,
          version: { increment: 1 },
        },
      });

      if (result.count === 0) {
        throw new Error('Conflito de concorrência. Tente novamente.');
      }

      const finalOS = await tx.serviceOrder.findUnique({ where: { id } });

      // Quando OS é concluída com chipId, cria/atualiza registro de Chip
      if (newStatus === 'COMPLETED' && os.chipId) {
        const chipService = new ChipService();
        await chipService.createFromOS(os.chipId, os.clientId, os.id);
      }

      return finalOS;
    });
  }

  async assign(id: string, team: string, technicianId?: string | null) {
    const os = await prisma.serviceOrder.findUnique({ where: { id } });
    if (!os) throw new Error('OS não encontrada');
    if (os.status === 'COMPLETED' || os.status === 'CANCELLED') {
      throw new Error('Não é possível reatribuir uma OS finalizada ou cancelada');
    }

    if (technicianId) {
      const technician = await prisma.technician.findUnique({
        where: { id: technicianId },
        include: { serviceOrders: { where: { status: 'IN_PROGRESS' } } },
      });
      if (!technician) throw new Error('Técnico não encontrado');
      if (!technician.isActive) throw new Error('Técnico inativo');
      if (technician.serviceOrders.length >= technician.maxConcurrentOS) {
        throw new Error('Técnico excedeu limite de OS simultâneas');
      }
    }

    return prisma.serviceOrder.update({
      where: { id },
      data: {
        team,
        technicianId: technicianId === null ? null : (technicianId ?? os.technicianId),
      },
      include: { client: true, technician: true },
    });
  }

  async updateExecution(id: string, data: UpdateExecutionInput) {
    const os = await prisma.serviceOrder.findUnique({ where: { id } });
    if (!os) throw new Error('OS não encontrada');
    if (os.status === 'COMPLETED') throw new Error('Não é possível atualizar execução de uma OS já concluída');
    if (os.status === 'CANCELLED') throw new Error('Não é possível atualizar execução de uma OS cancelada');

    const updateData: Record<string, unknown> = {};
    if (data.checkinAt !== undefined) updateData.checkinAt = new Date(data.checkinAt);
    if (data.checkoutAt !== undefined) updateData.checkoutAt = new Date(data.checkoutAt);
    if (data.checkinLocation !== undefined) updateData.checkinLocation = data.checkinLocation;
    if (data.photoUrls !== undefined) updateData.photoUrls = data.photoUrls;
    if (data.clientSignature !== undefined) updateData.clientSignature = data.clientSignature;
    if (data.chipId !== undefined) updateData.chipId = data.chipId;

    return prisma.serviceOrder.update({
      where: { id },
      data: updateData,
      include: { client: true, technician: true },
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
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (filters.status) where.status = filters.status;
    if (filters.team) where.team = filters.team;
    if (filters.technicianId) where.technicianId = filters.technicianId;
    if (filters.priority) where.priority = filters.priority;

    const [serviceOrders, total] = await Promise.all([
      prisma.serviceOrder.findMany({
        where,
        skip,
        take: limit,
        include: { client: true, technician: true },
        orderBy: [{ openingDate: 'desc' }],
      }),
      prisma.serviceOrder.count({ where }),
    ]);

    return { serviceOrders, total, page, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    const os = await prisma.serviceOrder.findUnique({
      where: { id },
      include: {
        client: true,
        technician: true,
        items: { include: { product: true } },
        payments: true,
        materialRequests: { include: { product: true } },
      },
    });
    if (!os) throw new Error('OS não encontrada');
    return os;
  }

  async delete(id: string) {
    const os = await prisma.serviceOrder.findUnique({ where: { id } });
    if (!os) throw new Error('OS não encontrada');
    if (os.status === 'COMPLETED') throw new Error('Não é possível excluir uma OS concluída');
    if (os.status === 'IN_PROGRESS') throw new Error('Não é possível excluir uma OS em andamento. Cancele-a primeiro');
    await prisma.serviceOrder.delete({ where: { id } });
    return { success: true };
  }
}

