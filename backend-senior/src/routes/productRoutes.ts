import { FastifyInstance } from 'fastify';
import { ProductController } from '../controllers/productController';
import { authenticate, authorize } from '../middlewares/auth';
import { prisma } from '../lib/prisma';

const controller = new ProductController();

export default async function productRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  app.get('/', controller.list.bind(controller));
  app.get('/low-stock', controller.lowStock.bind(controller));
  app.post('/', { onRequest: authorize('ADMIN', 'STOCK') }, controller.create.bind(controller));
  app.patch<{ Params: { id: string }; Body: { quantity: number; reason: string } }>(
    '/:id/stock',
    { onRequest: authorize('ADMIN', 'STOCK') },
    controller.adjustStock.bind(controller)
  );
  app.get<{ Params: { id: string }; Querystring: { page?: string; limit?: string } }>(
    '/:id/movements',
    async (request, reply) => {
      const { id } = request.params;
      const user = request.user as { companyId: string };
      const page = parseInt(request.query.page ?? '1');
      const limit = Math.min(parseInt(request.query.limit ?? '20'), 100);
      const skip = (page - 1) * limit;

      const product = await prisma.product.findFirst({
        where: { id, companyId: user.companyId },
        select: { id: true },
      });
      if (!product) {
        return reply.status(404).send({ error: 'Produto nao encontrado' });
      }

      const [movements, total] = await Promise.all([
        prisma.stockMovement.findMany({
          where: { productId: id, companyId: user.companyId },
          skip,
          take: limit,
          include: { serviceOrder: { include: { client: true } } },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.stockMovement.count({ where: { productId: id, companyId: user.companyId } }),
      ]);

      return reply.send({ movements, total, page, totalPages: Math.ceil(total / limit) });
    }
  );
}
