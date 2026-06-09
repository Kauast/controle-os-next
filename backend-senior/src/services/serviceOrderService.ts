import { Status } from '@prisma/client';
import dayjs from 'dayjs';
import { canTransition, createOSSchema, CreateOSInput } from '../lib/serviceOrderRules';
import { prisma } from '../lib/prisma';

export { createOSSchema, canTransition, type CreateOSInput };

export class ServiceOrderService {
  async create(data: CreateOSInput) {
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
      if (activeOS > 0) throw new Error('Cliente já possui uma OS em aberto');

      const dueDate = new Date(data.dueDate);
      if (dueDate < dayjs().add(1, 'day').toDate()) {
        throw new Error('Prazo deve ser no mínimo amanhã');
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
          items: { create: data.items },
        },
        include: { client: true, technician: true, items: true },
      });
    });
  }

  async updateStatus(id: string, newStatus: Status, cancellationReason?: string) {
    return prisma.$transaction(async (tx) => {
      const os = await tx.serviceOrder.findUnique({
        where: { id },
        include: { payments: true },
      });
      if (!os) throw new Error('OS não encontrada');

      if (!canTransition(os.status, newStatus)) {
        throw new Error(`Transição inválida: ${os.status} → ${newStatus}`);
      }

      if (newStatus === 'CANCELLED' && !cancellationReason) {
        throw new Error('Motivo do cancelamento é obrigatório');
      }

      if (newStatus === 'COMPLETED') {
        const totalPaid = os.payments.reduce((sum, p) => sum + Number(p.amount), 0);
        if (totalPaid < Number(os.totalAmount)) {
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

      return tx.serviceOrder.findUnique({ where: { id } });
    });
  }

  async list(filters: { status?: Status; page?: number; limit?: number }) {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 10, 100);
    const skip = (page - 1) * limit;
    const where = filters.status ? { status: filters.status } : {};

    const [serviceOrders, total] = await Promise.all([
      prisma.serviceOrder.findMany({
        where,
        skip,
        take: limit,
        include: { client: true, technician: true },
        orderBy: { openingDate: 'desc' },
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
      },
    });
    if (!os) throw new Error('OS não encontrada');
    return os;
  }
}
