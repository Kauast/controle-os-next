import { z } from 'zod';
import { AuditAction } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { RequestContext } from '../shared/context/requestContext';
import { audit } from '../lib/audit';

export const createTechnicianSchema = z.object({
  userId: z.string().cuid(),
  name: z.string().min(2),
  phone: z.string().optional().default(''),
  team: z.string().optional().default(''),
  teamId: z.string().optional(),
  specialty: z.string().optional(),
  statusField: z.string().optional().default('Disponivel'),
  maxConcurrentOS: z.number().int().positive().default(5),
});

export const updateTechnicianSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  team: z.string().optional(),
  teamId: z.string().optional(),
  specialty: z.string().optional(),
  statusField: z.string().optional(),
  maxConcurrentOS: z.number().int().positive().optional(),
});

export type CreateTechnicianInput = z.infer<typeof createTechnicianSchema>;
export type UpdateTechnicianInput = z.infer<typeof updateTechnicianSchema>;

export class TechnicianService {
  async create(data: CreateTechnicianInput) {
    const tenantId = RequestContext.get().tenantId;
    if (!tenantId) throw new AppError('Tenant não resolvido', 400);

    const existing = await prisma.technician.findFirst({ where: { tenantId, userId: data.userId, deletedAt: null } });
    if (existing) throw new AppError('Técnico já cadastrado para este usuário', 409);

    return prisma.technician.create({
      data: { tenantId, ...data },
    });
  }

  async list() {
    const tenantId = RequestContext.get().tenantId;
    if (!tenantId) throw new AppError('Tenant não resolvido', 400);

    return prisma.technician.findMany({
      where: { tenantId, isActive: true, deletedAt: null },
      include: {
        serviceOrders: {
          where: { status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_PARTS'] }, deletedAt: null },
          select: { id: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    const tenantId = RequestContext.get().tenantId;
    if (!tenantId) throw new AppError('Tenant não resolvido', 400);

    const tech = await prisma.technician.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { serviceOrders: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 10 } },
    });
    if (!tech) throw new AppError('Técnico não encontrado', 404);
    return tech;
  }

  async update(id: string, data: UpdateTechnicianInput) {
    const tenantId = RequestContext.get().tenantId;
    if (!tenantId) throw new AppError('Tenant não resolvido', 400);

    const tech = await prisma.technician.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!tech) throw new AppError('Técnico não encontrado', 404);

    const updated = await prisma.technician.updateMany({
      where: { id, tenantId, version: tech.version, deletedAt: null },
      data: { ...data, version: { increment: 1 } },
    });
    if (updated.count === 0) throw new AppError('Conflito de concorrência ao atualizar técnico', 409);

    const finalTech = await prisma.technician.findFirst({ where: { id, tenantId } });
    await audit({
      tenantId,
      entity: 'Technician',
      entityId: id,
      action: AuditAction.UPDATE,
      before: tech,
      after: finalTech,
    });

    return finalTech;
  }

  async deactivate(id: string) {
    return this.update(id, { statusField: 'Inativo' }).then(async () => {
      const tenantId = RequestContext.get().tenantId;
      if (!tenantId) throw new AppError('Tenant não resolvido', 400);
      return prisma.technician.updateMany({
        where: { id, tenantId, deletedAt: null },
        data: { isActive: false },
      });
    });
  }
}

