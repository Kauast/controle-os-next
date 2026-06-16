import { FastifyInstance } from 'fastify';
import { authenticate } from '../../app';
import { paymentsController } from './payments.controller';

export async function paymentsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', authenticate);

  app.get('/',         paymentsController.list);
  app.post('/',        paymentsController.create);
  app.post('/:id/cancel', paymentsController.cancel);
}
