import { FastifyInstance } from 'fastify';
import { ServiceOrderController } from '../controllers/serviceOrderController';
import { authenticate } from '../middlewares/auth';

const controller = new ServiceOrderController();

export default async function serviceOrderRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  app.post('/', controller.create.bind(controller));
  app.get('/', controller.list.bind(controller));
  app.get('/:id', controller.findById.bind(controller));
  app.patch('/:id/status', controller.updateStatus.bind(controller));
}
