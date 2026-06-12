import { z } from 'zod';
import { AuditAction } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { RequestContext } from '../shared/context/requestContext';
import { audit } from '../lib/audit';

export const createClientSchema = z.object({
  name: z.string().min(2),
  document: z.string().min(3).max(30),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().max(2).optional(),
  contactName: z.string().optional(),
});

export const updateClientSchema = createClientSchema.partial().extend({
  isBlocked: z.boolean().optional(),
  blockedReason: z.string().optional(),
});

const importClientSchema = z.object({
  name: z.string().min(1),
  document: z.string().min(1),
  phone: z.string().optional(),
  address: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  contactName: z.string().optional(),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type ImportClientInput = z.infer<typeof importClientSchema>;

export class ClientService {
  async create(data: CreateClientInput) {
    const tenantId = RequestContext.get().tenantId;
    if (!tenantId) throw new AppError('Tenant não resolvido', 400);

    const existing = await prisma.client.findFirst({
      where: { tenantId, document: data.document, deletedAt: null },
    });
    if (existing) throw new AppError('Documento já cadastrado', 409);

    const client = await prisma.client.create({
      data: { tenantId, ...data, email: data.email || null },
    });

    await audit({
      tenantId,
      entity: 'Client',
      entityId: client.id,
      action: AuditAction.INSERT,
      after: { name: client.name, document: client.document },
    });

    return client;
  }

  async importBatch(items: ImportClientInput[]) {
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const item of items) {
      try {
        const validated = importClientSchema.parse(item);
        await this.create(validated);
        created++;
      } catch (error: unknown) {
        if (error instanceof AppError && error.statusCode === 409) {
          skipped++;
          continue;
        }
        errors.push(`${item.document}: ${error instanceof Error ? error.message : 'erro desconhecido'}`);
      }
    }

    return { created, skipped, errors };
  }

  async list(filters: { page?: number; limit?: number; search?: string }) {
    const tenantId = RequestContext.get().tenantId;
    if (!tenantId) throw new AppError('Tenant não resolvido', 400);

    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 10, 100);
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      deletedAt: null,
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: 'insensitive' as const } },
              { document: { contains: filters.search, mode: 'insensitive' as const } },
              { phone: { contains: filters.search } },
            ],
          }
        : {}),
    };

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: { chips: { where: { deletedAt: null }, select: { id: true, status: true } } },
      }),
      prisma.client.count({ where }),
    ]);

    return { clients, total, page, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    const tenantId = RequestContext.get().tenantId;
    if (!tenantId) throw new AppError('Tenant não resolvido', 400);

    const client = await prisma.client.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        serviceOrders: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { technician: true },
        },
        chips: {
          where: { deletedAt: null },
          orderBy: { installedAt: 'desc' },
          include: { serviceOrder: { select: { id: true, number: true } } },
        },
        invoices: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!client) throw new AppError('Cliente não encontrado', 404);
    return client;
  }

  async update(id: string, data: UpdateClientInput) {
    const tenantId = RequestContext.get().tenantId;
    if (!tenantId) throw new AppError('Tenant não resolvido', 400);

    const client = await prisma.client.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!client) throw new AppError('Cliente não encontrado', 404);

    const updated = await prisma.client.updateMany({
      where: { id, tenantId, version: client.version, deletedAt: null },
      data: { ...data, version: { increment: 1 } },
    });
    if (updated.count === 0) throw new AppError('Conflito de concorrência ao atualizar cliente', 409);

    const finalClient = await prisma.client.findFirst({ where: { id, tenantId } });
    await audit({
      tenantId,
      entity: 'Client',
      entityId: id,
      action: AuditAction.UPDATE,
      before: client,
      after: finalClient,
    });

    return finalClient;
  }

  async delete(id: string) {
    const tenantId = RequestContext.get().tenantId;
    if (!tenantId) throw new AppError('Tenant não resolvido', 400);

    const hasActiveOS = await prisma.serviceOrder.count({
      where: {
        tenantId,
        clientId: id,
        deletedAt: null,
        status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_PARTS'] },
      },
    });
    if (hasActiveOS > 0) throw new AppError('Cliente possui OS ativas e não pode ser excluído', 409);

    const client = await prisma.client.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!client) throw new AppError('Cliente não encontrado', 404);
    await prisma.client.delete({ where: { id: client.id } });
    return { success: true };
  }
}

