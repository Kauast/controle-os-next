import { FastifyInstance } from 'fastify';
import {
  listClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  blockClient,
  unblockClient,
} from './clients.controller';

export async function clientRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('preHandler', app.authenticate);

  app.get('/clients', listClients);
  app.get('/clients/:id', getClient);
  app.post('/clients', createClient);
  app.patch('/clients/:id', updateClient);
  app.delete('/clients/:id', deleteClient);
  app.post('/clients/:id/block', blockClient);
  app.post('/clients/:id/unblock', unblockClient);
}
