import { FastifyInstance } from 'fastify';
import { authenticate, authorize } from '../middlewares/auth';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

const createSchema = z.object({
  serviceOrderId: z.string().cuid(),
  productId: z.string().cuid(),
  quantity: z.number().int().positive(),
  requestedBy: z.string().optional(),
});

const reviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reviewNote: z.string().optional(),
  reviewedBy: z.string().optional(),
});

export default async function materialRequestRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  app.get<{ Querystring: { serviceOrderId?: string; status?: string } }>(
    '/',
    async (request, reply) => {
      const { serviceOrderId, status } = request.query;
      const where: Record<string, unknown> = {};
      if (serviceOrderId) where.serviceOrderId = serviceOrderId;
      if (status) where.status = status;

      const requests = await prisma.materialRequest.findMany({
        where,
        include: { product: true, serviceOrder: { include: { client: true } } },
        orderBy: { createdAt: 'desc' },
      });
      return reply.send(requests);
    }
  );

  app.post('/', { onRequest: authorize('ADMIN', 'ATTENDANT', 'TECHNICIAN') }, async (request, reply) => {
    const data = createSchema.parse(request.body);

    const [product, os] = await Promise.all([
      prisma.product.findUnique({ where: { id: data.productId } }),
      prisma.serviceOrder.findUnique({ where: { id: data.serviceOrderId } }),
    ]);
    if (!product) throw new Error('Produto não encontrado');
    if (!os) throw new Error('OS não encontrada');

    const req = await prisma.materialRequest.create({
      data,
      include: { product: true, serviceOrder: { include: { client: true } } },
    });
    return reply.status(201).send(req);
  });

  app.patch<{ Params: { id: string } }>(
    '/:id/review',
    { onRequest: authorize('ADMIN', 'STOCK') },
    async (request, reply) => {
      const { id } = request.params;
      const data = reviewSchema.parse(request.body);

      const req = await prisma.materialRequest.findUnique({ where: { id } });
      if (!req) throw new Error('Solicitação não encontrada');
      if (req.status !== 'PENDING') throw new Error('Solicitação já foi revisada');

      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.materialRequest.update({
          where: { id },
          data: { status: data.status, reviewNote: data.reviewNote, reviewedBy: data.reviewedBy },
          include: { product: true },
        });

        if (data.status === 'APPROVED') {
          await tx.product.update({
            where: { id: req.productId },
            data: { stockQuantity: { decrement: req.quantity } },
          });
          await tx.stockMovement.create({
            data: {
              productId: req.productId,
              type: 'OUT',
              quantity: req.quantity,
              reason: `Solicitação de material para OS`,
              serviceOrderId: req.serviceOrderId,
            },
          });
        }

        return result;
      });

      return reply.send(updated);
    }
  );

  app.delete<{ Params: { id: string } }>(
    '/:id',
    { onRequest: authorize('ADMIN', 'ATTENDANT', 'TECHNICIAN') },
    async (request, reply) => {
      const { id } = request.params;
      const req = await prisma.materialRequest.findUnique({ where: { id } });
      if (!req) throw new Error('Solicitação não encontrada');
      if (req.status !== 'PENDING') throw new Error('Só é possível cancelar solicitações pendentes');

      await prisma.materialRequest.delete({ where: { id } });
      return reply.send({ success: true });
    }
  );
}
