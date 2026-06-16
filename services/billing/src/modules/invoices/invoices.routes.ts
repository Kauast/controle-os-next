import { FastifyInstance } from 'fastify';
import { authenticate } from '../../app';
import { invoicesController } from './invoices.controller';

export async function invoicesRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', authenticate);

  app.get('/',        invoicesController.list);
  app.get('/:id',     invoicesController.findById);
  app.post('/',       invoicesController.create);
  app.post('/:id/issue',  invoicesController.issue);
  app.post('/:id/cancel', invoicesController.cancel);
}
