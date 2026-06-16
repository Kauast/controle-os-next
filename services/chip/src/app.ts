import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { env } from './env';
import { chipRoutes } from './modules/chips/chips.routes';
import { metricsText, metricsContentType, httpRequestDuration, httpRequestsTotal } from './lib/metrics';
import { prisma } from './lib/prisma';
import { dependencyUp } from './lib/metrics';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      base: { service: 'chip-service', version: env.APP_VERSION },
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie'],
        censor: '[REDACTED]',
      },
    },
    genReqId: () => crypto.randomUUID(),
    trustProxy: true,
  });

  // ── Security ──────────────────────────────────────────────────────────────
  await app.register(helmet, { global: true });

  await app.register(cors, {
    origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  await app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Muitas requisicoes. Tente novamente em instantes.',
    }),
  });

  // ── Auth ──────────────────────────────────────────────────────────────────
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: '1h' },
  });

  // ── Observability hooks ───────────────────────────────────────────────────
  app.addHook('onRequest', async (req: any, reply) => {
    reply.header('x-request-id', req.id);
    req._startTime = process.hrtime.bigint();
  });

  app.addHook('onResponse', async (req: any, reply) => {
    const start = req._startTime as bigint | undefined;
    const seconds = start ? Number(process.hrtime.bigint() - start) / 1e9 : 0;
    const route = (req.routeOptions?.url ?? req.url.split('?')[0]) as string;
    const labels = { method: req.method, route, status_code: String(reply.statusCode) };
    httpRequestDuration.observe(labels, seconds);
    httpRequestsTotal.inc(labels);
  });

  // ── Routes ────────────────────────────────────────────────────────────────
  await app.register(chipRoutes, { prefix: '/v1' });

  // ── Health ────────────────────────────────────────────────────────────────
  app.get('/health', async (_req, reply) => {
    return reply.send({
      status: 'ok',
      service: 'chip-service',
      version: env.APP_VERSION,
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
    });
  });

  app.get('/health/ready', async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      dependencyUp.set({ dependency: 'database' }, 1);
      return reply.send({ status: 'ready' });
    } catch (err) {
      dependencyUp.set({ dependency: 'database' }, 0);
      return reply.status(503).send({ status: 'not_ready', error: (err as Error).message });
    }
  });

  // ── Metrics ───────────────────────────────────────────────────────────────
  app.get('/metrics', async (_req, reply) => {
    reply.header('content-type', metricsContentType);
    return reply.send(await metricsText());
  });

  // ── Global error handler ──────────────────────────────────────────────────
  app.setErrorHandler((err, req, reply) => {
    req.log.error({ err, reqId: req.id }, 'unhandled_error');
    reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Erro interno do servidor' });
  });

  return app;
}
