import { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../lib/prisma';
import { RequestContext } from '../shared/context/requestContext';
import { DEFAULT_ROLE_PERMISSIONS, hasAnyPermission } from '../shared/security/access-control';

type AuthenticatedUser = {
  id: string;
  tenantId: string;
  name?: string;
  email: string;
  role: keyof typeof DEFAULT_ROLE_PERMISSIONS;
  permissions: string[];
  iat?: number;
};

async function resolvePermissions(userId: string, fallbackRole: keyof typeof DEFAULT_ROLE_PERMISSIONS) {
  const assignments = await prisma.userRole.findMany({
    where: { userId },
    include: {
      role: {
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  });

  const permissions = new Set(DEFAULT_ROLE_PERMISSIONS[fallbackRole] ?? []);
  for (const assignment of assignments) {
    for (const rolePermission of assignment.role.rolePermissions) {
      permissions.add(rolePermission.permission.code);
    }
  }

  return Array.from(permissions);
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (error: unknown) {
    const isExpired = error instanceof Error && error.message.includes('expired');
    return reply.status(401).send({
      error: isExpired ? 'Token expirado' : 'Não autorizado',
      code: isExpired ? 'TOKEN_EXPIRED' : 'UNAUTHORIZED',
    });
  }

  const decoded = request.user as {
    id: string;
    tenantId: string;
    email: string;
    role: keyof typeof DEFAULT_ROLE_PERMISSIONS;
    iat?: number;
  };

  const user = await prisma.user.findFirst({
    where: {
      id: decoded.id,
      tenantId: decoded.tenantId,
      deletedAt: null,
    },
    select: {
      id: true,
      tenantId: true,
      name: true,
      email: true,
      role: true,
      active: true,
      passwordChangedAt: true,
    },
  });

  if (!user || !user.active) {
    return reply.status(401).send({ error: 'Usuário inativo ou inexistente', code: 'UNAUTHORIZED' });
  }

  if (user.passwordChangedAt && decoded.iat) {
    const changedAtSec = Math.floor(user.passwordChangedAt.getTime() / 1000);
    if (changedAtSec > decoded.iat) {
      return reply.status(401).send({
        error: 'Senha alterada. Faça login novamente.',
        code: 'PASSWORD_CHANGED',
      });
    }
  }

  const permissions = await resolvePermissions(user.id, user.role);
  const authUser: AuthenticatedUser = {
    id: user.id,
    tenantId: user.tenantId,
    name: user.name ?? undefined,
    email: user.email,
    role: user.role,
    permissions,
    iat: decoded.iat,
  };

  request.user = authUser;
  RequestContext.set({
    tenantId: user.tenantId,
    userId: user.id,
    userEmail: user.email,
    role: user.role,
    permissions,
    ip: request.ip,
    userAgent: request.headers['user-agent'],
  });
}

export function authorize(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser | undefined;
    if (!user || !roles.includes(user.role)) {
      return reply.status(403).send({ error: 'Acesso negado', code: 'FORBIDDEN' });
    }
  };
}

export function authorizePermissions(...requiredPermissions: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser | undefined;
    if (!user || !hasAnyPermission(user.permissions, requiredPermissions)) {
      return reply.status(403).send({ error: 'Permissão insuficiente', code: 'FORBIDDEN' });
    }
  };
}

