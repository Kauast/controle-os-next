import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { audit } from '../audit/audit.service';
import { NotFoundError, ConflictError, ConcurrencyError, AppError } from '../../shared/errors';
import { parsePagination, buildPaginatedResult } from '../../shared/pagination';

export const createClientSchema = z.object({
  name: z.string().min(2).max(200),
  document: z.string().min(11).max(18),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().max(2).optional(),
  contactName: z.string().optional(),
});

export const updateClientSchema = createClientSchema.partial();

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;

interface RequestUser {
  id: string;
  companyId: string;
}

export class ClientService {
  async create(data: CreateClientInput, user: RequestUser) {
    const existing = await prisma.client.findFirst({
      where: { companyId: user.companyId, document: data.document },
    });
    if (existing) throw new ConflictError('Documento já cadastrado');

    const client = await prisma.client.create({
      data: { ...data, companyId: user.companyId },
    });

    await audit({
      companyId: user.companyId, userId: user.id,
      entity: 'Client', entityId: client.id,
      action: 'CLIENT_CREATED', after: { name: client.name, document: client.document },
    });

    return client;
  }

  async update(id: string, data: UpdateClientInput, user: RequestUser) {
    return prisma.$transaction(async (tx) => {
      const client = await tx.client.findFirst({ where: { id, companyId: user.companyId } });
      if (!client) throw new NotFoundError('Cliente');

      if (data.document && data.document !== client.document) {
        const conflict = await tx.client.findFirst({
          where: { companyId: user.companyId, document: data.document, id: { not: id } },
        });
        if (conflict) throw new ConflictError('Documento já em uso');
      }

      const before = { name: client.name, document: client.document, version: client.version };

      const result = await tx.client.updateMany({
        where: { id, companyId: user.companyId, version: client.version },
        data: { ...data, version: { increment: 1 } },
      });
      if (result.count === 0) throw new ConcurrencyError();

      await audit({
        companyId: user.companyId, userId: user.id,
        entity: 'Client', entityId: id,
        action: 'CLIENT_UPDATED', before, after: data,
      });

      return tx.client.findFirst({ where: { id } });
    });
  }

  async toggleBlock(id: string, blocked: boolean, reason: string | undefined, user: RequestUser) {
    return prisma.$transaction(async (tx) => {
      const client = await tx.client.findFirst({ where: { id, companyId: user.companyId } });
      if (!client) throw new NotFoundError('Cliente');

      if (blocked && !reason) throw new AppError('Motivo do bloqueio é obrigatório', 422);

      const result = await tx.client.updateMany({
        where: { id, companyId: user.companyId, version: client.version },
        data: {
          isBlocked: blocked,
          blockedReason: blocked ? reason : null,
          version: { increment: 1 },
        },
      });
      if (result.count === 0) throw new ConcurrencyError();

      await audit({
        companyId: user.companyId, userId: user.id,
        entity: 'Client', entityId: id,
        action: blocked ? 'CLIENT_BLOCKED' : 'CLIENT_UNBLOCKED',
        after: { reason },
      });

      return tx.client.findFirst({ where: { id } });
    });
  }

  async list(params: {
    companyId: string;
    search?: string;
    isBlocked?: boolean;
    page?: number;
    limit?: number;
  }) {
    const { page, limit, skip } = parsePagination(params);
    const where: Prisma.ClientWhereInput = { companyId: params.companyId };

    if (params.isBlocked !== undefined) where.isBlocked = params.isBlocked;
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { document: { contains: params.search } },
        { phone: { contains: params.search } },
        { email: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        select: {
          id: true, name: true, document: true, phone: true,
          email: true, city: true, state: true,
          isBlocked: true, blockedReason: true,
          _count: { select: { serviceOrders: true } },
        },
      }),
      prisma.client.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findById(id: string, companyId: string) {
    const client = await prisma.client.findFirst({
      where: { id, companyId },
      include: {
        serviceOrders: {
          where: { deletedAt: null },
          select: { id: true, number: true, status: true, openingDate: true, totalAmount: true },
          orderBy: { openingDate: 'desc' },
          take: 10,
        },
        chips: { select: { id: true, iccid: true, status: true } },
        _count: { select: { serviceOrders: true } },
      },
    });
    if (!client) throw new NotFoundError('Cliente');
    return client;
  }

  async delete(id: string, user: RequestUser) {
    const client = await prisma.client.findFirst({ where: { id, companyId: user.companyId } });
    if (!client) throw new NotFoundError('Cliente');

    const activeOS = await prisma.serviceOrder.count({
      where: { clientId: id, status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_PARTS'] } },
    });
    if (activeOS > 0) throw new AppError('Cliente possui OS em andamento', 422);

    await prisma.client.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: user.id },
    });

    await audit({
      companyId: user.companyId, userId: user.id,
      entity: 'Client', entityId: id,
      action: 'CLIENT_DELETED', before: { name: client.name, document: client.document },
    });

    return { success: true };
  }
}
