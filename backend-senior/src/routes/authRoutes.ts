import { FastifyInstance } from 'fastify';
import { AuthController } from '../controllers/authController';
import { authenticate, authorize } from '../middlewares/auth';

const controller = new AuthController();

export default async function authRoutes(app: FastifyInstance) {
  // Criação de usuário restrita a ADMIN — use seed-users.ts para bootstrap inicial
  app.post('/register', { onRequest: [authenticate, authorize('ADMIN')] }, controller.register.bind(controller));
  app.post('/login', controller.login.bind(controller));
  app.get('/me', { onRequest: authenticate }, controller.me.bind(controller));
}
