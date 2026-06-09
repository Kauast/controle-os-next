import { FastifyInstance } from 'fastify';
import { ClientController } from '../controllers/clientController';
import { authenticate, authorize } from '../middlewares/auth';

const controller = new ClientController();

export default async function clientRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  app.get<{ Querystring: { page?: string; limit?: string; search?: string } }>(
    '/',
    controller.list.bind(controller)
  );
  app.get<{ Params: { id: string } }>(
    '/:id',
    controller.findById.bind(controller)
  );
  app.post(
    '/',
    { onRequest: authorize('ADMIN', 'ATTENDANT') },
    controller.create.bind(controller)
  );
  app.put<{ Params: { id: string } }>(
    '/:id',
    { onRequest: authorize('ADMIN', 'ATTENDANT') },
    controller.update.bind(controller)
  );
  app.delete<{ Params: { id: string } }>(
    '/:id',
    { onRequest: authorize('ADMIN') },
    controller.delete.bind(controller)
  );
}
