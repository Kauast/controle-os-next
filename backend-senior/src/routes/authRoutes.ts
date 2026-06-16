import { FastifyInstance } from 'fastify';
import { AuthController } from '../controllers/authController';
import { authenticate, authorize } from '../middlewares/auth';
import { config } from '../lib/config';

const controller = new AuthController();

export default async function authRoutes(app: FastifyInstance) {
  app.post('/register', { onRequest: [authenticate, authorize('ADMIN')] }, controller.register.bind(controller));

  // Login: rate limit estrito por IP para prevenção de brute-force
  app.post('/login', {
    config: {
      rateLimit: {
        max: config.loginRateLimitMax,
        timeWindow: '15 minutes',
        keyGenerator: (req) => `login:${req.ip}`,
      },
    },
  }, controller.login.bind(controller));

  // Refresh: renova a sessão usando um refresh token. NÃO exige access token válido.
  // Aceita o token via cookie httpOnly `refresh_token` (preferencial) ou body { refreshToken }.
  // Rate limit moderado: previne enumeração de tokens, mas permite uso normal.
  app.post('/refresh', {
    config: {
      rateLimit: {
        max: 30,
        timeWindow: '15 minutes',
        keyGenerator: (req) => `refresh:${req.ip}`,
      },
    },
  }, controller.refresh.bind(controller));

  app.get('/me', { onRequest: authenticate }, controller.me.bind(controller));
  app.post('/forgot-password', controller.forgotPassword.bind(controller));
  app.post('/reset-password', controller.resetPassword.bind(controller));
}
