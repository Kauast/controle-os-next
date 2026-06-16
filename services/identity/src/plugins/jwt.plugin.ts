import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma';

/**
 * Middleware de autenticação — verifica o JWT emitido por este servico.
 * Invalida tokens emitidos antes de uma troca de senha (passwordChangedAt).
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err: unknown) {
    const isExpired = err instanceof Error && err.message.includes('expired');
    return reply.status(401).send({
      error: isExpired ? 'Token expirado' : 'Nao autorizado',
      code: isExpired ? 'TOKEN_EXPIRED' : 'UNAUTHORIZED',
    });
  }

  const decoded = request.user as { sub: string; iat?: number; role: string; companyId: string };
  const userId = decoded.sub;

  if (userId && decoded.iat) {
    const user = await prisma.user.findFirst({
      where: { id: userId },
      select: { passwordChangedAt: true, active: true },
    });

    if (!user || !user.active) {
      return reply.status(401).send({ error: 'Usuario inativo ou inexistente', code: 'UNAUTHORIZED' });
    }

    if (user.passwordChangedAt) {
      const changedAtSec = Math.floor(user.passwordChangedAt.getTime() / 1000);
      if (changedAtSec > decoded.iat) {
        return reply.status(401).send({
          error: 'Senha alterada. Faca login novamente.',
          code: 'PASSWORD_CHANGED',
        });
      }
    }
  }
}

/**
 * Factory de middleware de autorização por role.
 */
export function authorize(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as { role: string } | undefined;
    if (!user || !roles.includes(user.role)) {
      return reply.status(403).send({ error: 'Acesso negado', code: 'FORBIDDEN' });
    }
  };
}

/**
 * Tipo do usuário autenticado disponível em request.user
 * (baseado no payload JWT emitido por este servico).
 */
export interface AuthUser {
  sub: string;
  companyId: string;
  role: string;
  name?: string;
  email?: string;
  iat?: number;
  exp?: number;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthUser;
    user: AuthUser;
  }
}
