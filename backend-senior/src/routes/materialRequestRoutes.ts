import { FastifyInstance } from 'fastify';
import { authenticate, authorize } from '../middlewares/auth';
import { prisma } from '../lib/prisma';
import { StockService } from '../modules/stock/stock.service';
import { z } from 'zod';

const stockService = new StockService();

const createSchema = z.object({
  serviceOrderId: z.string().min(1),
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  requestedBy: z.string().optional(),
});

const reviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reviewNote: z.string().optional(),
  reviewedBy: z.string().optional(),
});

interface RequestUser {
  id: string;
  companyId: string;
}

export default async function materialRequestRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  app.get<{ Querystring: { serviceOrderId?: string; status?: string } }>(
    '/',
    async (request, reply) => {
      const { serviceOrderId, status } = request.query;
      const user = request.user as RequestUser;
      const where: Record<string, unknown> = {};
      if (serviceOrderId) where.serviceOrderId = serviceOrderId;
      if (status) where.status = status;

      const requests = await prisma.materialRequest.findMany({
        where: {
          ...where,
          serviceOrder: { companyId: user.companyId },
        },
        include: { product: true, serviceOrder: { include: { client: true } } },
        orderBy: { createdAt: 'desc' },
      });
      return reply.send(requests);
    }
  );

  app.post('/', { onRequest: authorize('ADMIN', 'ATTENDANT', 'TECHNICIAN') }, async (request, reply) => {
    const data = createSchema.parse(request.body);
    const user = request.user as RequestUser;

    const [product, os] = await Promise.all([
      prisma.product.findFirst({ where: { id: data.productId, companyId: user.companyId } }),
      prisma.serviceOrder.findFirst({ where: { id: data.serviceOrderId, companyId: user.companyId } }),
    ]);
    if (!product) return reply.status(404).send({ error: 'Produto não encontrado' });
    if (!os) return reply.status(404).send({ error: 'OS não encontrada' });

    const req = await prisma.materialRequest.create({
      data: { ...data, companyId: user.companyId, requestedBy: data.requestedBy ?? user.id },
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
      const user = request.user as RequestUser;

      const req = await prisma.materialRequest.findFirst({
        where: { id, serviceOrder: { companyId: user.companyId } },
      });
      if (!req) return reply.status(404).send({ error: 'Solicitação não encontrada' });
      if (req.status !== 'PENDING') return reply.status(422).send({ error: 'Solicitação já foi revisada' });

      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.materialRequest.update({
          where: { id },
          data: {
            status: data.status,
            reviewNote: data.reviewNote,
            reviewedBy: data.reviewedBy ?? user.id,
          },
          include: { product: true },
        });

        if (data.status === 'APPROVED') {
          await stockService.adjustStock({
            companyId: user.companyId,
            productId: req.productId,
            type: 'OUT',
            quantity: req.quantity,
            reason: `Solicitação de material para OS ${req.serviceOrderId}`,
            serviceOrderId: req.serviceOrderId,
            userId: user.id,
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
      const user = request.user as RequestUser;

      const req = await prisma.materialRequest.findFirst({
        where: { id, serviceOrder: { companyId: user.companyId } },
      });
      if (!req) return reply.status(404).send({ error: 'Solicitação não encontrada' });
      if (req.status !== 'PENDING') return reply.status(422).send({ error: 'Só é possível cancelar solicitações pendentes' });

      await prisma.materialRequest.deleteMany({ where: { id } });
      return reply.send({ success: true });
    }
  );
}
