import { z } from 'zod';
import { ChipStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';

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
    const existing = await prisma.chip.findUnique({ where: { iccid: data.iccid } });
    if (existing) throw new Error('ICCID já cadastrado');

    return prisma.chip.create({
      data: {
        ...data,
        installedAt: data.installedAt ? new Date(data.installedAt) : undefined,
      },
      include: { client: true, serviceOrder: { include: { client: true } } },
    });
  }

  async createFromOS(iccid: string, clientId: string, serviceOrderId: string) {
    const existing = await prisma.chip.findUnique({ where: { iccid } });
    if (existing) {
      return prisma.chip.update({
        where: { iccid },
        data: {
          clientId,
          serviceOrderId,
          status: 'ACTIVE',
          installedAt: new Date(),
        },
      });
    }
    return prisma.chip.create({
      data: {
        iccid,
        clientId,
        serviceOrderId,
        status: 'ACTIVE',
        installedAt: new Date(),
      },
    });
  }

  async list(filters: { clientId?: string; status?: ChipStatus; page?: number; limit?: number }) {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
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
    const chip = await prisma.chip.findUnique({
      where: { id },
      include: {
        client: true,
        serviceOrder: { include: { client: true, technician: true } },
      },
    });
    if (!chip) throw new Error('Chip não encontrado');
    return chip;
  }

  async update(id: string, data: UpdateChipInput) {
    const chip = await prisma.chip.findUnique({ where: { id } });
    if (!chip) throw new Error('Chip não encontrado');

    if (data.iccid && data.iccid !== chip.iccid) {
      const conflict = await prisma.chip.findUnique({ where: { iccid: data.iccid } });
      if (conflict) throw new Error('ICCID já em uso por outro chip');
    }

    return prisma.chip.update({
      where: { id },
      data: {
        ...data,
        installedAt: data.installedAt ? new Date(data.installedAt) : undefined,
      },
      include: { client: true, serviceOrder: true },
    });
  }

  async transfer(id: string, newClientId: string | null) {
    const chip = await prisma.chip.findUnique({ where: { id } });
    if (!chip) throw new Error('Chip não encontrado');

    if (newClientId) {
      const client = await prisma.client.findUnique({ where: { id: newClientId } });
      if (!client) throw new Error('Cliente não encontrado');
    }

    return prisma.chip.update({
      where: { id },
      data: {
        clientId: newClientId,
        status: newClientId ? 'ACTIVE' : 'INACTIVE',
        installedAt: newClientId ? new Date() : chip.installedAt,
      },
      include: { client: true },
    });
  }

  async delete(id: string) {
    const chip = await prisma.chip.findUnique({ where: { id } });
    if (!chip) throw new Error('Chip não encontrado');
    return prisma.chip.delete({ where: { id } });
  }
}
