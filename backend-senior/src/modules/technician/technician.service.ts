import { z } from 'zod';
import { TechnicianStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { audit } from '../audit/audit.service';
import { NotFoundError, ConflictError, ConcurrencyError, AppError } from '../../shared/errors';
import { parsePagination, buildPaginatedResult } from '../../shared/pagination';

export const createTechnicianSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(2),
  phone: z.string().optional().default(''),
  specialty: z.string().optional(),
  maxConcurrentOS: z.number().int().min(1).max(20).optional().default(5),
});

export const updateTechnicianSchema = createTechnicianSchema.partial().omit({ userId: true });

export type CreateTechnicianInput = z.infer<typeof createTechnicianSchema>;
export type UpdateTechnicianInput = z.infer<typeof updateTechnicianSchema>;

interface RequestUser {
  id: string;
  companyId: string;
}

export class TechnicianService {
  async create(data: CreateTechnicianInput, user: RequestUser) {
    const existing = await prisma.technician.findUnique({ where: { userId: data.userId } });
    if (existing) throw new ConflictError('Usuário já vinculado a um técnico');

    const userRecord = await prisma.user.findFirst({ where: { id: data.userId, companyId: user.companyId } });
    if (!userRecord) throw new NotFoundError('Usuário');

    const technician = await prisma.technician.create({
      data: { ...data, companyId: user.companyId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    await audit({
      companyId: user.companyId, userId: user.id,
      entity: 'Technician', entityId: technician.id,
      action: 'TECHNICIAN_CREATED', after: { name: technician.name },
    });

    return technician;
  }

  async update(id: string, data: UpdateTechnicianInput, user: RequestUser) {
    return prisma.$transaction(async (tx) => {
      const technician = await tx.technician.findFirst({ where: { id, companyId: user.companyId } });
      if (!technician) throw new NotFoundError('Técnico');

      const before = { name: technician.name, version: technician.version };

      const result = await tx.technician.updateMany({
        where: { id, companyId: user.companyId, version: technician.version },
        data: { ...data, version: { increment: 1 } },
      });
      if (result.count === 0) throw new ConcurrencyError();

      await audit({ companyId: user.companyId, userId: user.id, entity: 'Technician', entityId: id, action: 'TECHNICIAN_UPDATED', before, after: data });

      return tx.technician.findFirst({ where: { id }, include: { user: { select: { id: true, name: true, email: true } } } });
    });
  }

  async updateStatus(id: string, status: TechnicianStatus, user: RequestUser) {
    return prisma.$transaction(async (tx) => {
      const technician = await tx.technician.findFirst({ where: { id, companyId: user.companyId } });
      if (!technician) throw new NotFoundError('Técnico');

      const result = await tx.technician.updateMany({
        where: { id, version: technician.version },
        data: { status, version: { increment: 1 } },
      });
      if (result.count === 0) throw new ConcurrencyError();

      await audit({ companyId: user.companyId, userId: user.id, entity: 'Technician', entityId: id, action: 'TECHNICIAN_STATUS_CHANGED', before: { status: technician.status }, after: { status } });

      return tx.technician.findFirst({ where: { id } });
    });
  }

  async list(params: { companyId: string; isActive?: boolean; status?: TechnicianStatus; search?: string; page?: number; limit?: number }) {
    const { page, limit, skip } = parsePagination(params);
    const where: Record<string, unknown> = { companyId: params.companyId };
    if (params.isActive !== undefined) where.isActive = params.isActive;
    if (params.status) where.status = params.status;
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { specialty: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.technician.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true } },
          _count: { select: { serviceOrders: true } },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.technician.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findById(id: string, companyId: string) {
    const technician = await prisma.technician.findFirst({
      where: { id, companyId },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        teamMemberships: { include: { team: { select: { id: true, name: true } } } },
        serviceOrders: {
          where: { status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_PARTS'] } },
          select: { id: true, number: true, status: true, priority: true, dueDate: true },
        },
      },
    });
    if (!technician) throw new NotFoundError('Técnico');
    return technician;
  }

  async getWorkload(companyId: string) {
    const technicians = await prisma.technician.findMany({
      where: { companyId, isActive: true },
      include: {
        _count: {
          select: {
            serviceOrders: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return technicians.map((t) => ({
      id: t.id,
      name: t.name,
      status: t.status,
      maxConcurrentOS: t.maxConcurrentOS,
      activeOS: t._count.serviceOrders,
      capacity: Math.round((t._count.serviceOrders / t.maxConcurrentOS) * 100),
    }));
  }

  async delete(id: string, user: RequestUser) {
    const technician = await prisma.technician.findFirst({ where: { id, companyId: user.companyId } });
    if (!technician) throw new NotFoundError('Técnico');

    const activeOS = await prisma.serviceOrder.count({
      where: { technicianId: id, status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_PARTS'] } },
    });
    if (activeOS > 0) throw new AppError('Técnico possui OS em andamento', 422);

    await prisma.technician.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: user.id, isActive: false },
    });

    await audit({ companyId: user.companyId, userId: user.id, entity: 'Technician', entityId: id, action: 'TECHNICIAN_DELETED' });
    return { success: true };
  }
}
