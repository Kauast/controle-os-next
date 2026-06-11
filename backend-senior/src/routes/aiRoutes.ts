import { FastifyInstance } from 'fastify';
import { AiController } from '../controllers/aiController';
import { authenticate, authorize } from '../middlewares/auth';

const controller = new AiController();

export default async function aiRoutes(app: FastifyInstance) {
  // Triagem por IA — rate limit próprio (custo por chamada) e papéis operacionais.
  app.post('/triage', {
    onRequest: [authenticate, authorize('ADMIN', 'SUPERVISOR', 'ATTENDANT')],
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
  }, controller.triage.bind(controller));
}
