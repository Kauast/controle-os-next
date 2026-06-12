import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { audit } from '../audit/audit.service';
import { NotFoundError, AppError, ConcurrencyError } from '../../shared/errors';
import { parsePagination, buildPaginatedResult } from '../../shared/pagination';

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.nativeEnum(Role).optional(),
  active: z.boolean().optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

interface RequestUser {
  id: string;
  role: string;
  companyId: string;
}

export class UserService {
  async list(params: { companyId: string; role?: Role; active?: boolean; page?: number; limit?: number }) {
    const { page, limit, skip } = parsePagination(params);
    const where: Record<string, unknown> = { companyId: params.companyId };
    if (params.role) where.role = params.role;
    if (params.active !== undefined) where.active = params.active;

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true, name: true, email: true, role: true, active: true, createdAt: true,
          technician: { select: { id: true, name: true, status: true } },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.user.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findById(id: string, companyId: string) {
    const user = await prisma.user.findFirst({
      where: { id, companyId },
      select: {
        id: true, name: true, email: true, role: true, active: true, createdAt: true,
        technician: { select: { id: true, name: true, status: true, specialty: true } },
      },
    });
    if (!user) throw new NotFoundError('Usuário');
    return user;
  }

  async update(id: string, data: UpdateUserInput, requester: RequestUser) {
    const user = await prisma.user.findFirst({ where: { id, companyId: requester.companyId } });
    if (!user) throw new NotFoundError('Usuário');

    // Somente ADMIN pode alterar role
    if (data.role && requester.role !== 'ADMIN') {
      throw new AppError('Somente administradores podem alterar o perfil de acesso', 403);
    }

    // ADMIN não pode revogar o próprio acesso
    if (id === requester.id && data.active === false) {
      throw new AppError('Não é possível desativar o próprio usuário', 422);
    }

    const before = { name: user.name, role: user.role, active: user.active };

    await prisma.user.updateMany({
      where: { id, companyId: requester.companyId },
      data,
    });

    await audit({
      companyId: requester.companyId, userId: requester.id,
      entity: 'User', entityId: id,
      action: 'USER_UPDATED', before, after: data,
    });

    return prisma.user.findFirst({
      where: { id },
      select: { id: true, name: true, email: true, role: true, active: true },
    });
  }

  async delete(id: string, requester: RequestUser) {
    if (id === requester.id) throw new AppError('Não é possível excluir o próprio usuário', 422);

    const user = await prisma.user.findFirst({ where: { id, companyId: requester.companyId } });
    if (!user) throw new NotFoundError('Usuário');

    await prisma.user.update({ where: { id }, data: { deletedAt: new Date(), deletedBy: requester.id, active: false } });
    await prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });

    await audit({ companyId: requester.companyId, userId: requester.id, entity: 'User', entityId: id, action: 'USER_DELETED', before: { email: user.email, role: user.role } });
    return { success: true };
  }
}
