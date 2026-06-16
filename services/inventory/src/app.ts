import Fastify, { FastifyInstance, FastifyBaseLogger } from 'fastify';
import { randomUUID } from 'crypto';
import { ZodError } from 'zod';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import productsRoutes from './modules/products/products.routes';
import stockRoutes from './modules/stock/stock.routes';
import materialRequestsRoutes from './modules/material-requests/material-requests.routes';
import { AppError } from './lib/errors';
import { metricsText, metricsContentType, dependencyUp } from './lib/metrics';
import { env, isProd } from './env';
import { prisma } from './lib/prisma';
import pino from 'pino';

const logger = pino(
  isProd
    ? {}
    : { transport: { target: 'pino-pretty', options: { colorize: true } } },
);

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    loggerInstance: logger as unknown as FastifyBaseLogger,
    genReqId: (req) => (req.headers['x-request-id'] as string) ?? randomUUID(),
    requestIdHeader: 'x-request-id',
    trustProxy: true,
    disableRequestLogging: false,
  });

  // Timeout global de requisicoes
  app.addHook('onRequest', async (req, reply) => {
    if (req.url?.startsWith('/health') || req.url?.startsWith('/metrics')) return;
    const timer = setTimeout(() => {
      if (!reply.sent) {
        reply.status(503).send({ error: 'Tempo de resposta esgotado', code: 'TIMEOUT', reqId: req.id });
      }
    }, env.REQUEST_TIMEOUT_MS);
    reply.raw.on('finish', () => clearTimeout(timer));
    reply.raw.on('close', () => clearTimeout(timer));
  });

  // Handler global de erros
  app.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
    request.log.error({ err: error }, error.message);

    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: 'Dados invalidos',
        details: error.issues,
        reqId: request.id,
      });
    }
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: error.message,
        code: error.code,
        reqId: request.id,
      });
    }
    const statusCode = error.statusCode ?? 500;
    return reply.status(statusCode).send({
      error: statusCode === 500 ? 'Erro interno do servidor' : error.message,
      reqId: request.id,
    });
  });

  // CORS
  const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
  });

  // Helmet (seguranca de headers)
  await app.register(helmet, {
    ...(isProd ? { hsts: { maxAge: 31536000, includeSubDomains: true } } : {}),
  });

  // Rate limit por IP
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: '1 minute',
    errorResponseBuilder: (_req, ctx) => ({
      error: 'Muitas requisicoes. Tente novamente em breve.',
      code: 'RATE_LIMIT',
      retryAfter: ctx.after,
    }),
  });

  // JWT
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: '8h', iss: env.JWT_ISSUER, aud: env.JWT_AUDIENCE },
  });

  // Health checks
  app.get('/health', { config: { rateLimit: false } }, async () => ({
    status: 'ok',
    service: 'inventory-service',
    timestamp: new Date().toISOString(),
  }));

  app.get('/health/ready', { config: { rateLimit: false } }, async (_req, reply) => {
    let dbOk = true;
    try {
      await prisma.$queryRaw`SELECT 1`;
      dependencyUp.set({ dependency: 'postgres' }, 1);
    } catch {
      dbOk = false;
      dependencyUp.set({ dependency: 'postgres' }, 0);
    }

    const status = dbOk ? 'ok' : 'degraded';
    return reply.status(dbOk ? 200 : 503).send({
      status,
      dependencies: { postgres: dbOk ? 'up' : 'down' },
      timestamp: new Date().toISOString(),
    });
  });

  // Metricas Prometheus
  app.get('/metrics', { config: { rateLimit: false } }, async (req, reply) => {
    if (env.METRICS_TOKEN) {
      const header = (req.headers['x-metrics-token'] as string) ?? '';
      const bearer = (req.headers['authorization'] as string) ?? '';
      const token = bearer.startsWith('Bearer ') ? bearer.slice(7) : '';
      if (header !== env.METRICS_TOKEN && token !== env.METRICS_TOKEN) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
    }
    reply.header('Content-Type', metricsContentType);
    return reply.send(await metricsText());
  });

  // Rotas de dominio
  await app.register(productsRoutes, { prefix: '/products' });
  await app.register(stockRoutes, { prefix: '/' });
  await app.register(materialRequestsRoutes, { prefix: '/material-requests' });

  return app;
}
