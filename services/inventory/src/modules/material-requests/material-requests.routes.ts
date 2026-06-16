import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middlewares/auth';
import {
  listMaterialRequests,
  createMaterialRequest,
  reviewMaterialRequest,
} from './material-requests.controller';

export default async function materialRequestsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  app.get('/', listMaterialRequests);
  app.post('/', createMaterialRequest);
  app.patch('/:id/review', reviewMaterialRequest);
}
