import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma';

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err: unknown) {
    const isExpired = err instanceof Error && err.message.includes('expired');
    return reply.status(401).send({
      error: isExpired ? 'Token expirado' : 'Não autorizado',
      code: isExpired ? 'TOKEN_EXPIRED' : 'UNAUTHORIZED',
    });
  }

  // Invalida JWT se a senha foi alterada após a emissão do token.
  const decoded = request.user as { id: string; iat?: number; role: string; companyId: string };
  if (decoded.id && decoded.iat) {
    // findFirst em vez de findUnique: a extensão de soft-delete injeta deletedAt=null
    // no where de findFirst, mas rejeitaria findUnique (campo fora da chave única).
    const user = await prisma.user.findFirst({
      where: { id: decoded.id },
      select: { passwordChangedAt: true, active: true },
    });
    if (!user || !user.active) {
      return reply.status(401).send({ error: 'Usuário inativo ou inexistente', code: 'UNAUTHORIZED' });
    }
    if (user.passwordChangedAt) {
      const changedAtSec = Math.floor(user.passwordChangedAt.getTime() / 1000);
      if (changedAtSec > decoded.iat) {
        return reply.status(401).send({
          error: 'Senha alterada. Faça login novamente.',
          code: 'PASSWORD_CHANGED',
        });
      }
    }
  }
}

export function authorize(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as { role: string } | undefined;
    if (!user || !roles.includes(user.role)) {
      return reply.status(403).send({ error: 'Acesso negado', code: 'FORBIDDEN' });
    }
  };
}
