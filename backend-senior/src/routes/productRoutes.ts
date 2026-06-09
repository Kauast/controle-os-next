import { FastifyInstance } from 'fastify';
import { ProductController } from '../controllers/productController';
import { authenticate, authorize } from '../middlewares/auth';

const controller = new ProductController();

export default async function productRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  app.get('/', controller.list.bind(controller));
  app.get('/low-stock', controller.lowStock.bind(controller));
  app.post('/', { onRequest: authorize('ADMIN', 'ATTENDANT') }, controller.create.bind(controller));
  app.patch<{ Params: { id: string }; Body: { quantity: number; reason: string } }>(
    '/:id/stock',
    { onRequest: authorize('ADMIN', 'ATTENDANT') },
    controller.adjustStock.bind(controller)
  );
}
