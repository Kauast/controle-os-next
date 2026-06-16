import { FastifyInstance } from 'fastify';
import {
  listChips,
  getChip,
  getChipHistory,
  createChip,
  updateChip,
  deleteChip,
  assignChip,
  installChip,
  releaseChip,
} from './chips.controller';

export async function chipRoutes(app: FastifyInstance) {
  // Todas as rotas exigem JWT
  app.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Token invalido ou ausente' });
    }
  });

  // CRUD basico
  app.get('/chips', listChips);
  app.get('/chips/:id', getChip);
  app.get('/chips/:id/history', getChipHistory);
  app.post('/chips', createChip);
  app.patch('/chips/:id', updateChip);
  app.delete('/chips/:id', deleteChip);

  // Lifecycle
  app.post('/chips/:id/assign', assignChip);
  app.post('/chips/:id/install', installChip);
  app.post('/chips/:id/release', releaseChip);
}
