import { FastifyInstance } from 'fastify';
import { ClientController } from '../controllers/clientController';
import { authenticate } from '../middlewares/auth';

const controller = new ClientController();

export default async function clientRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  app.post('/', controller.create.bind(controller));
  app.get('/', controller.list.bind(controller));
  app.get('/:id', controller.findById.bind(controller));
  app.put('/:id', controller.update.bind(controller));
  app.delete('/:id', controller.delete.bind(controller));
}
