import { Role } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { hashPassword } from '../../lib/hash';
import { audit } from '../../lib/audit';
import { publishEvent } from '../../lib/publisher';
import { AppError, NotFoundError, ForbiddenError } from '../../lib/errors';
import { parsePagination, buildPaginatedResult } from '../../lib/pagination';
import { AuthService } from '../auth/auth.service';
import type { CreateUserInput, UpdateUserInput, ListUsersQuery } from './users.schema';

interface RequestUser {
  sub: string;
  role: string;
  companyId: string;
  email?: string;
}

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  createdAt: true,
} as const;

export class UsersService {
  async list(requester: RequestUser, query: ListUsersQuery) {
    const { page, limit, skip } = parsePagination(query);
    const where: Record<string, unknown> = { companyId: requester.companyId };
    if (query.role) where.role = query.role as Role;
    if (query.active !== undefined) where.active = query.active;

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: USER_SELECT,
        orderBy: { name: 'asc' },
      }),
      prisma.user.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findById(id: string, requester: RequestUser) {
    const user = await prisma.user.findFirst({
      where: { id, companyId: requester.companyId },
      select: USER_SELECT,
    });
    if (!user) throw new NotFoundError('Usuario');
    return user;
  }

  async create(data: CreateUserInput, requester: RequestUser) {
    const existing = await prisma.user.findFirst({
      where: { email: data.email, companyId: requester.companyId },
    });
    if (existing) throw new AppError('E-mail ja cadastrado nesta empresa', 409);

    const company = await prisma.company.findUnique({ where: { id: requester.companyId } });
    if (!company || !company.active) throw new AppError('Empresa nao encontrada ou inativa', 404);

    const hashed = await hashPassword(data.password);
    const user = await prisma.user.create({
      data: {
        companyId: requester.companyId,
        name: data.name,
        email: data.email,
        password: hashed,
        role: data.role as Role,
      },
      select: USER_SELECT,
    });

    await audit({
      companyId: requester.companyId,
      userId: requester.sub,
      userEmail: requester.email,
      entity: 'User',
      entityId: user.id,
      action: 'USER_CREATED',
      after: { email: user.email, role: user.role },
    });

    // Publica evento de dominio para outros servicos
    await publishEvent('user.created', requester.companyId, {
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    return user;
  }

  async update(id: string, data: UpdateUserInput, requester: RequestUser) {
    const user = await prisma.user.findFirst({ where: { id, companyId: requester.companyId } });
    if (!user) throw new NotFoundError('Usuario');

    // Somente ADMIN pode alterar role
    if (data.role && requester.role !== 'ADMIN') {
      throw new ForbiddenError('Somente administradores podem alterar o perfil de acesso');
    }

    // ADMIN nao pode revogar o proprio acesso
    if (id === requester.sub && data.active === false) {
      throw new AppError('Nao e possivel desativar o proprio usuario', 422);
    }

    const before = { name: user.name, role: user.role, active: user.active };

    await prisma.user.updateMany({
      where: { id, companyId: requester.companyId },
      data,
    });

    await audit({
      companyId: requester.companyId,
      userId: requester.sub,
      entity: 'User',
      entityId: id,
      action: 'USER_UPDATED',
      before,
      after: data,
    });

    // Publica evento se usuario foi desativado
    if (data.active === false) {
      await publishEvent('user.deactivated', requester.companyId, {
        userId: id,
        email: user.email,
      });
    }

    return prisma.user.findFirst({
      where: { id },
      select: USER_SELECT,
    });
  }

  async delete(id: string, requester: RequestUser) {
    if (id === requester.sub) throw new AppError('Nao e possivel excluir o proprio usuario', 422);

    const user = await prisma.user.findFirst({ where: { id, companyId: requester.companyId } });
    if (!user) throw new NotFoundError('Usuario');

    await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: requester.sub, active: false },
    });

    // Revogar todos os refresh tokens do usuario excluido
    await prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await audit({
      companyId: requester.companyId,
      userId: requester.sub,
      entity: 'User',
      entityId: id,
      action: 'USER_DELETED',
      before: { email: user.email, role: user.role },
    });

    await publishEvent('user.deactivated', requester.companyId, {
      userId: id,
      email: user.email,
      deleted: true,
    });

    return { success: true };
  }

  async resetPasswordByAdmin(
    id: string,
    newPassword: string,
    requester: RequestUser,
  ) {
    const user = await prisma.user.findFirst({ where: { id, companyId: requester.companyId } });
    if (!user) throw new NotFoundError('Usuario');

    const hashed = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id },
      data: { password: hashed, passwordChangedAt: new Date(), loginAttempts: 0 },
    });

    // Revogar todos os refresh tokens ativos do usuario
    const authService = new AuthService();
    await authService.revokeAllUserTokens(id);

    await audit({
      companyId: requester.companyId,
      userId: requester.sub,
      action: 'ADMIN_PASSWORD_RESET',
      detail: `Senha de ${user.email} redefinida pelo admin`,
    });
  }
}
