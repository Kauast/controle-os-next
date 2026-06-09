import { FastifyRequest, FastifyReply } from 'fastify';

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    reply.status(401).send({ error: 'Não autorizado' });
  }
}

export function authorize(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as { role: string } | undefined;
    if (!user || !roles.includes(user.role)) {
      reply.status(403).send({ error: 'Acesso negado' });
    }
  };
}
