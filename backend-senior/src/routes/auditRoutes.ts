import { FastifyInstance } from 'fastify';
import { authenticate, authorize } from '../middlewares/auth';
import { prisma } from '../lib/prisma';

export default async function auditRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);
  app.addHook('onRequest', authorize('ADMIN'));

  app.get<{ Querystring: { page?: string; limit?: string; action?: string } }>('/', async (request, reply) => {
    const page  = Math.max(1, Number(request.query.page  ?? 1));
    const limit = Math.min(100, Math.max(1, Number(request.query.limit ?? 50)));
    const skip  = (page - 1) * limit;
    const where = request.query.action ? { action: request.query.action } : {};
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit, skip }),
      prisma.auditLog.count({ where }),
    ]);
    return reply.send({ logs, total, page, limit, pages: Math.ceil(total / limit) });
  });
}
