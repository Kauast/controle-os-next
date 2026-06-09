import { FastifyInstance } from 'fastify';
import { TechnicianController } from '../controllers/technicianController';
import { authenticate, authorize } from '../middlewares/auth';

const controller = new TechnicianController();

export default async function technicianRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  app.get('/', controller.list.bind(controller));
  app.get('/:id', controller.findById.bind(controller));
  app.post('/', { onRequest: authorize('ADMIN') }, controller.create.bind(controller));
  app.patch<{ Params: { id: string } }>(
    '/:id/deactivate',
    { onRequest: authorize('ADMIN') },
    controller.deactivate.bind(controller)
  );
}
