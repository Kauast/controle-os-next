import { FastifyInstance } from 'fastify';
import { AuthController } from './auth.controller';
import { authenticate } from '../../plugins/jwt.plugin';
import { env } from '../../env';

const controller = new AuthController();

export default async function authRoutes(app: FastifyInstance) {
  // POST /auth/login — rate limit estrito por IP (brute-force)
  app.post('/login', {
    config: {
      rateLimit: {
        max: env.LOGIN_RATE_LIMIT_MAX,
        timeWindow: '15 minutes',
        keyGenerator: (req) => `login:${req.ip}`,
      },
    },
  }, controller.login.bind(controller));

  // POST /auth/refresh — renova sessao sem exigir access token valido
  app.post('/refresh', {
    config: {
      rateLimit: {
        max: 30,
        timeWindow: '15 minutes',
        keyGenerator: (req) => `refresh:${req.ip}`,
      },
    },
  }, controller.refresh.bind(controller));

  // POST /auth/logout — revoga refresh token
  app.post('/logout', controller.logout.bind(controller));

  // GET /auth/me — retorna usuario autenticado (valida JWT)
  app.get('/me', { onRequest: [authenticate] }, controller.me.bind(controller));

  // POST /auth/password/reset/request — envia e-mail de reset
  app.post('/password/reset/request', controller.forgotPassword.bind(controller));

  // POST /auth/password/reset/confirm — confirma reset com token
  app.post('/password/reset/confirm', controller.resetPassword.bind(controller));

  // POST /auth/password/change — troca senha (usuario autenticado)
  app.post('/password/change', { onRequest: [authenticate] }, controller.changePassword.bind(controller));
}
