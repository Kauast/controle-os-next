import { z } from 'zod';
import { ChipStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { audit } from '../audit/audit.service';
import { NotFoundError, ConflictError, ConcurrencyError } from '../../shared/errors';
import { parsePagination, buildPaginatedResult } from '../../shared/pagination';

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

export const updateChipSchema = createChipSchema.partial().omit({ iccid: true });
export type CreateChipInput = z.infer<typeof createChipSchema>;
export type UpdateChipInput = z.infer<typeof updateChipSchema>;

interface RequestUser {
  id: string;
  companyId: string;
}

export class ChipService {
  async create(data: CreateChipInput, user: RequestUser) {
    const existing = await prisma.chip.findFirst({ where: { companyId: user.companyId, iccid: data.iccid } });
    if (existing) throw new ConflictError('ICCID já cadastrado');

    const chip = await prisma.chip.create({
      data: {
        ...data,
        companyId: user.companyId,
        installedAt: data.installedAt ? new Date(data.installedAt) : undefined,
      },
      include: { client: true, serviceOrder: { select: { id: true, number: true } } },
    });

    await audit({ companyId: user.companyId, userId: user.id, entity: 'Chip', entityId: chip.id, action: 'CHIP_CREATED', after: { iccid: chip.iccid } });
    return chip;
  }

  async update(id: string, data: UpdateChipInput, user: RequestUser) {
    return prisma.$transaction(async (tx) => {
      const chip = await tx.chip.findFirst({ where: { id, companyId: user.companyId } });
      if (!chip) throw new NotFoundError('Chip');

      const before = { status: chip.status, clientId: chip.clientId, version: chip.version };

      const result = await tx.chip.updateMany({
        where: { id, companyId: user.companyId, version: chip.version },
        data: {
          ...data,
          installedAt: data.installedAt ? new Date(data.installedAt) : undefined,
          version: { increment: 1 },
        },
      });
      if (result.count === 0) throw new ConcurrencyError();

      await audit({ companyId: user.companyId, userId: user.id, entity: 'Chip', entityId: id, action: 'CHIP_UPDATED', before, after: data });

      return tx.chip.findFirst({ where: { id }, include: { client: true, serviceOrder: true } });
    });
  }

  // Transferência de chip entre clientes com histórico completo
  async transfer(id: string, newClientId: string | null, serviceOrderId: string | undefined, user: RequestUser) {
    return prisma.$transaction(async (tx) => {
      const chip = await tx.chip.findFirst({ where: { id, companyId: user.companyId } });
      if (!chip) throw new NotFoundError('Chip');

      if (newClientId) {
        const client = await tx.client.findFirst({ where: { id: newClientId, companyId: user.companyId } });
        if (!client) throw new NotFoundError('Cliente');
      }

      const result = await tx.chip.updateMany({
        where: { id, companyId: user.companyId, version: chip.version },
        data: {
          clientId: newClientId,
          serviceOrderId: serviceOrderId ?? chip.serviceOrderId,
          status: newClientId ? 'ACTIVE' : 'INACTIVE',
          installedAt: newClientId ? new Date() : chip.installedAt,
          version: { increment: 1 },
        },
      });
      if (result.count === 0) throw new ConcurrencyError();

      // Histórico imutável de transferência
      await tx.chipHistory.create({
        data: {
          chipId: id,
          fromClientId: chip.clientId,
          toClientId: newClientId,
          serviceOrderId,
          action: newClientId ? 'TRANSFERRED' : 'UNLINKED',
          userId: user.id,
        },
      });

      await audit({
        companyId: user.companyId, userId: user.id,
        entity: 'Chip', entityId: id,
        action: 'CHIP_TRANSFERRED',
        before: { clientId: chip.clientId },
        after: { clientId: newClientId },
      });

      return tx.chip.findFirst({ where: { id }, include: { client: true, history: { orderBy: { createdAt: 'desc' }, take: 5 } } });
    });
  }

  async createFromOS(iccid: string, clientId: string, serviceOrderId: string, companyId: string, userId?: string) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.chip.findFirst({ where: { companyId, iccid } });

      if (existing) {
        const prevClientId = existing.clientId;
        await tx.chip.updateMany({
          where: { id: existing.id, version: existing.version },
          data: { clientId, serviceOrderId, status: 'ACTIVE', installedAt: new Date(), version: { increment: 1 } },
        });
        await tx.chipHistory.create({
          data: { chipId: existing.id, fromClientId: prevClientId, toClientId: clientId, serviceOrderId, action: 'OS_COMPLETED', userId },
        });
        return tx.chip.findFirst({ where: { id: existing.id } });
      }

      const chip = await tx.chip.create({
        data: { companyId, iccid, clientId, serviceOrderId, status: 'ACTIVE', installedAt: new Date() },
      });
      await tx.chipHistory.create({
        data: { chipId: chip.id, toClientId: clientId, serviceOrderId, action: 'CREATED_FROM_OS', userId },
      });
      return chip;
    });
  }

  async list(params: { companyId: string; clientId?: string; status?: ChipStatus; page?: number; limit?: number }) {
    const { page, limit, skip } = parsePagination(params);
    const where: Record<string, unknown> = { companyId: params.companyId };
    if (params.clientId) where.clientId = params.clientId;
    if (params.status) where.status = params.status;

    const [data, total] = await Promise.all([
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

    return buildPaginatedResult(data, total, page, limit);
  }

  async findById(id: string, companyId: string) {
    const chip = await prisma.chip.findFirst({
      where: { id, companyId },
      include: {
        client: true,
        serviceOrder: { include: { client: true, technician: true } },
        history: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!chip) throw new NotFoundError('Chip');
    return chip;
  }

  // Soft delete de chip
  async delete(id: string, user: RequestUser) {
    const chip = await prisma.chip.findFirst({ where: { id, companyId: user.companyId } });
    if (!chip) throw new NotFoundError('Chip');

    await prisma.chip.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: user.id, status: 'INACTIVE' },
    });

    await audit({ companyId: user.companyId, userId: user.id, entity: 'Chip', entityId: id, action: 'CHIP_DELETED', before: { iccid: chip.iccid } });
    return { success: true };
  }
}
