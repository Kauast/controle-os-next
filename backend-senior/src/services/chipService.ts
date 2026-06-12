import { z } from 'zod';
import { AuditAction, ChipStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { RequestContext } from '../shared/context/requestContext';
import { audit } from '../lib/audit';

export const createChipSchema = z.object({
  iccid: z.string().min(3).max(30),
  phoneNumber: z.string().optional(),
  operator: z.string().optional(),
  model: z.string().optional(),
  status: z.nativeEnum(ChipStatus).optional(),
  notes: z.string().optional(),
  clientId: z.string().cuid().optional(),
  serviceOrderId: z.string().cuid().optional(),
  installedAt: z.string().datetime().optional(),
});

export const updateChipSchema = createChipSchema.partial();

export type CreateChipInput = z.infer<typeof createChipSchema>;
export type UpdateChipInput = z.infer<typeof updateChipSchema>;

export class ChipService {
  async create(data: CreateChipInput) {
    const tenantId = RequestContext.get().tenantId;
    if (!tenantId) throw new AppError('Tenant não resolvido', 400);

    const existing = await prisma.chip.findUnique({ where: { iccid: data.iccid } });
    if (existing && !existing.deletedAt) throw new AppError('ICCID já cadastrado', 409);

    const chip = await prisma.chip.create({
      data: {
        tenantId,
        ...data,
        installedAt: data.installedAt ? new Date(data.installedAt) : undefined,
      },
      include: { client: true, serviceOrder: { include: { client: true } } },
    });

    await audit({
      tenantId,
      entity: 'Chip',
      entityId: chip.id,
      action: AuditAction.INSERT,
      after: { iccid: chip.iccid, clientId: chip.clientId },
    });

    return chip;
  }

  async createFromOS(iccid: string, clientId: string, serviceOrderId: string) {
    const tenantId = RequestContext.get().tenantId;
    if (!tenantId) return null;

    const existing = await prisma.chip.findUnique({ where: { iccid } });
    if (existing) {
      await prisma.chip.updateMany({
        where: { id: existing.id, version: existing.version, deletedAt: null },
        data: {
          clientId,
          serviceOrderId,
          status: ChipStatus.ACTIVE,
          installedAt: new Date(),
          version: { increment: 1 },
        },
      });
      return prisma.chip.findFirst({ where: { id: existing.id } });
    }

    return prisma.chip.create({
      data: {
        tenantId,
        iccid,
        clientId,
        serviceOrderId,
        status: ChipStatus.ACTIVE,
        installedAt: new Date(),
      },
    });
  }

  async list(filters: { clientId?: string; status?: ChipStatus; page?: number; limit?: number }) {
    const tenantId = RequestContext.get().tenantId;
    if (!tenantId) throw new AppError('Tenant não resolvido', 400);

    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId, deletedAt: null };
    if (filters.clientId) where.clientId = filters.clientId;
    if (filters.status) where.status = filters.status;

    const [chips, total] = await Promise.all([
      prisma.chip.findMany({
        where,
        skip,
        take: limit,
        include: {
          client: { select: { id: true, name: true } },
          serviceOrder: { select: { id: true, number: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.chip.count({ where }),
    ]);

    return { chips, total, page, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    const tenantId = RequestContext.get().tenantId;
    if (!tenantId) throw new AppError('Tenant não resolvido', 400);

    const chip = await prisma.chip.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        client: true,
        serviceOrder: { include: { client: true, technician: true } },
      },
    });
    if (!chip) throw new AppError('Chip não encontrado', 404);
    return chip;
  }

  async update(id: string, data: UpdateChipInput) {
    const tenantId = RequestContext.get().tenantId;
    if (!tenantId) throw new AppError('Tenant não resolvido', 400);

    const chip = await prisma.chip.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!chip) throw new AppError('Chip não encontrado', 404);

    if (data.iccid && data.iccid !== chip.iccid) {
      const conflict = await prisma.chip.findUnique({ where: { iccid: data.iccid } });
      if (conflict && !conflict.deletedAt) throw new AppError('ICCID já em uso por outro chip', 409);
    }

    const updated = await prisma.chip.updateMany({
      where: { id, tenantId, version: chip.version, deletedAt: null },
      data: {
        ...data,
        installedAt: data.installedAt ? new Date(data.installedAt) : undefined,
        version: { increment: 1 },
      },
    });
    if (updated.count === 0) throw new AppError('Conflito de concorrência ao atualizar chip', 409);

    return prisma.chip.findFirst({
      where: { id, tenantId },
      include: { client: true, serviceOrder: true },
    });
  }

  async transfer(id: string, newClientId: string | null) {
    const tenantId = RequestContext.get().tenantId;
    if (!tenantId) throw new AppError('Tenant não resolvido', 400);

    const chip = await prisma.chip.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!chip) throw new AppError('Chip não encontrado', 404);

    if (newClientId) {
      const client = await prisma.client.findFirst({ where: { id: newClientId, tenantId, deletedAt: null } });
      if (!client) throw new AppError('Cliente não encontrado', 404);
    }

    const updated = await prisma.chip.updateMany({
      where: { id, tenantId, version: chip.version, deletedAt: null },
      data: {
        clientId: newClientId,
        status: newClientId ? ChipStatus.ACTIVE : ChipStatus.INACTIVE,
        installedAt: newClientId ? new Date() : chip.installedAt,
        version: { increment: 1 },
      },
    });
    if (updated.count === 0) throw new AppError('Conflito de concorrência ao transferir chip', 409);

    return prisma.chip.findFirst({
      where: { id, tenantId },
      include: { client: true },
    });
  }

  async delete(id: string) {
    const tenantId = RequestContext.get().tenantId;
    if (!tenantId) throw new AppError('Tenant não resolvido', 400);

    const chip = await prisma.chip.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!chip) throw new AppError('Chip não encontrado', 404);
    await prisma.chip.delete({ where: { id: chip.id } });
  }
}

