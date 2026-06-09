import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

export const createClientSchema = z.object({
  name: z.string().min(2),
  document: z.string().min(11).max(18),
  phone: z.string().optional(),
  email: z.string().email().optional(),
});

export const updateClientSchema = createClientSchema.partial().extend({
  isBlocked: z.boolean().optional(),
  blockedReason: z.string().optional(),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;

export class ClientService {
  async create(data: CreateClientInput) {
    const existing = await prisma.client.findUnique({ where: { document: data.document } });
    if (existing) throw new Error('Documento já cadastrado');
    return prisma.client.create({ data });
  }

  async list(filters: { page?: number; limit?: number; search?: string }) {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 10, 100);
    const skip = (page - 1) * limit;

    const where = filters.search
      ? {
          OR: [
            { name: { contains: filters.search, mode: 'insensitive' as const } },
            { document: { contains: filters.search } },
          ],
        }
      : {};

    const [clients, total] = await Promise.all([
      prisma.client.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
      prisma.client.count({ where }),
    ]);

    return { clients, total, page, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    const client = await prisma.client.findUnique({
      where: { id },
      include: { serviceOrders: { orderBy: { createdAt: 'desc' }, take: 5 } },
    });
    if (!client) throw new Error('Cliente não encontrado');
    return client;
  }

  async update(id: string, data: UpdateClientInput) {
    const client = await prisma.client.findUnique({ where: { id } });
    if (!client) throw new Error('Cliente não encontrado');
    return prisma.client.update({ where: { id }, data });
  }

  async delete(id: string) {
    const hasActiveOS = await prisma.serviceOrder.count({
      where: { clientId: id, status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_PARTS'] } },
    });
    if (hasActiveOS > 0) throw new Error('Cliente possui OS ativas e não pode ser excluído');
    return prisma.client.delete({ where: { id } });
  }
}
