import { z } from 'zod';
import { prisma } from '../lib/prisma';

export const createTechnicianSchema = z.object({
  userId: z.string().cuid(),
  name: z.string().min(2),
  phone: z.string().optional().default(''),
  team: z.string().optional().default(''),
  specialty: z.string().optional(),
  statusField: z.string().optional().default('Disponivel'),
  maxConcurrentOS: z.number().int().positive().default(5),
});

export const updateTechnicianSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  team: z.string().optional(),
  specialty: z.string().optional(),
  statusField: z.string().optional(),
});

export type CreateTechnicianInput = z.infer<typeof createTechnicianSchema>;
export type UpdateTechnicianInput = z.infer<typeof updateTechnicianSchema>;

export class TechnicianService {
  async create(data: CreateTechnicianInput) {
    const existing = await prisma.technician.findUnique({ where: { userId: data.userId } });
    if (existing) throw new Error('Técnico já cadastrado para este usuário');
    return prisma.technician.create({ data });
  }

  async list() {
    return prisma.technician.findMany({
      where: { isActive: true },
      include: {
        serviceOrders: { where: { status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_PARTS'] } }, select: { id: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    const tech = await prisma.technician.findUnique({
      where: { id },
      include: { serviceOrders: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });
    if (!tech) throw new Error('Técnico não encontrado');
    return tech;
  }

  async update(id: string, data: UpdateTechnicianInput) {
    const tech = await prisma.technician.findUnique({ where: { id } });
    if (!tech) throw new Error('Técnico não encontrado');
    return prisma.technician.update({ where: { id }, data });
  }

  async deactivate(id: string) {
    const tech = await prisma.technician.findUnique({ where: { id } });
    if (!tech) throw new Error('Técnico não encontrado');
    return prisma.technician.update({ where: { id }, data: { isActive: false } });
  }
}
