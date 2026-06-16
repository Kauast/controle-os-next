import { TechnicianStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { publish } from '../../lib/publisher';
import { NotFoundError, ConflictError } from '../../lib/errors';
import { parsePagination, buildPaginatedResult } from '../../lib/pagination';
import type {
  CreateTechnicianInput,
  UpdateTechnicianInput,
  ListTechniciansQuery,
} from './technicians.schema';

export class TechnicianService {
  async create(data: CreateTechnicianInput) {
    const existing = await prisma.technician.findUnique({ where: { userId: data.userId } });
    if (existing) {
      throw new ConflictError('userId já vinculado a um técnico existente');
    }

    const technician = await prisma.technician.create({
      data: {
        companyId: data.companyId,
        userId: data.userId,
        name: data.name,
        email: data.email ?? null,
        maxConcurrentOS: data.maxConcurrentOS,
        specialties: data.specialties,
      },
    });

    await publish('technician.created', {
      technicianId: technician.id,
      companyId: technician.companyId,
      userId: technician.userId,
      name: technician.name,
    });

    return technician;
  }

  async list(companyId: string, query: ListTechniciansQuery) {
    const { page, limit, skip } = parsePagination(query);

    const where: Record<string, unknown> = { companyId };
    if (query.status !== undefined) where.status = query.status;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    const [data, total] = await Promise.all([
      prisma.technician.findMany({
        where,
        skip,
        take: limit,
        include: {
          teamMembers: {
            include: { team: { select: { id: true, name: true } } },
          },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.technician.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findById(id: string, companyId: string) {
    const technician = await prisma.technician.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        teamMembers: {
          include: { team: { select: { id: true, name: true } } },
        },
      },
    });

    if (!technician) throw new NotFoundError('Técnico');
    return technician;
  }

  async getCapacity(id: string, companyId: string) {
    const technician = await prisma.technician.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true, currentOsCount: true, maxConcurrentOS: true },
    });

    if (!technician) throw new NotFoundError('Técnico');

    return {
      currentOsCount: technician.currentOsCount,
      maxConcurrentOS: technician.maxConcurrentOS,
      hasCapacity: technician.currentOsCount < technician.maxConcurrentOS,
    };
  }

  async update(id: string, companyId: string, data: UpdateTechnicianInput) {
    const technician = await prisma.technician.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!technician) throw new NotFoundError('Técnico');

    return prisma.technician.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.maxConcurrentOS !== undefined && { maxConcurrentOS: data.maxConcurrentOS }),
        ...(data.specialties !== undefined && { specialties: data.specialties }),
      },
    });
  }

  async updateStatus(id: string, companyId: string, status: TechnicianStatus) {
    const technician = await prisma.technician.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!technician) throw new NotFoundError('Técnico');

    const updated = await prisma.technician.update({
      where: { id },
      data: { status },
    });

    await publish('technician.status_changed', {
      technicianId: id,
      companyId,
      previousStatus: technician.status,
      newStatus: status,
    });

    return updated;
  }

  async softDelete(id: string, companyId: string) {
    const technician = await prisma.technician.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!technician) throw new NotFoundError('Técnico');

    const deleted = await prisma.technician.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await publish('technician.deactivated', {
      technicianId: id,
      companyId,
    });

    return deleted;
  }
}
