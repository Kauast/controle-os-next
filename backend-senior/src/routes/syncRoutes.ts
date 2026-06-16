import { FastifyInstance } from 'fastify';
import { SyncController } from '../controllers/syncController';
import { authenticate } from '../middlewares/auth';

const controller = new SyncController();

export default async function syncRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);
  app.post('/batch', controller.batch.bind(controller));
}
