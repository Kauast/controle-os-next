import { FastifyInstance } from 'fastify';
import { authenticate } from '../../app';
import { financialController } from './financial.controller';

export async function financialRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', authenticate);

  app.get('/movements', financialController.listMovements);
  app.get('/summary',   financialController.summary);
}
