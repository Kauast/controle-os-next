import { FastifyInstance } from 'fastify';
import { AuthController } from '../controllers/authController';
import { authenticate } from '../middlewares/auth';

const controller = new AuthController();

export default async function authRoutes(app: FastifyInstance) {
  app.post('/register', controller.register.bind(controller));
  app.post('/login', controller.login.bind(controller));
  app.get('/me', { onRequest: authenticate }, controller.me.bind(controller));
}
