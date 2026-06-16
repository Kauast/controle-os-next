import Fastify, { type FastifyInstance, type FastifyBaseLogger, type FastifyRequest } from 'fastify';
import { randomUUID } from 'crypto';
import { ZodError } from 'zod';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { env } from './env';
import { logger } from './lib/logger';
import { AppError } from './lib/errors';
import { metricsText, metricsContentType, httpRequestDuration, httpRequestsTotal } from './lib/metrics';
import { prisma } from './lib/prisma';
import notificationRoutes from './modules/notifications/notifications.routes';

// ─── Normaliza rota para evitar explosao de cardinalidade nas metricas ────────
function routeLabel(req: FastifyRequest): string {
  return (req.routeOptions as { url?: string } | undefined)?.url ?? req.url.split('?')[0];
}

type TimedRequest = FastifyRequest & { _startTime?: bigint };

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    loggerInstance:     logger as unknown as FastifyBaseLogger,
    genReqId:           (req) => (req.headers['x-request-id'] as string) ?? randomUUID(),
    requestIdHeader:    'x-request-id',
    trustProxy:         true,
    disableRequestLogging: true,
  });

  // ── Observabilidade: x-request-id no response + metricas HTTP ─────────────
  app.addHook('onRequest', async (req, reply) => {
    reply.header('x-request-id', req.id);
    (req as TimedRequest)._startTime = process.hrtime.bigint();
  });

  app.addHook('onResponse', async (req, reply) => {
    const start   = (req as TimedRequest)._startTime;
    const seconds = start ? Number(process.hrtime.bigint() - start) / 1e9 : 0;
    const labels  = { method: req.method, route: routeLabel(req), status_code: String(reply.statusCode) };
    httpRequestDuration.observe(labels, seconds);
    httpRequestsTotal.inc(labels);

    req.log.info(
      { event: 'http_response', reqId: req.id, method: req.method, route: routeLabel(req), statusCode: reply.statusCode, durationMs: Math.round(seconds * 1000 * 100) / 100 },
      'http_response',
    );
  });

  // ── Tratamento de erros centralizado ──────────────────────────────────────
  app.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
    request.log.error({
      event:      'request_error',
      reqId:      request.id,
      route:      routeLabel(request),
      errName:    error.name,
      errMessage: error.message,
      stack:      error.stack,
    }, 'request_error');

    if (error instanceof ZodError) {
      return reply.status(400).send({ error: 'Dados invalidos', details: error.issues, reqId: request.id });
    }
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ error: error.message, reqId: request.id });
    }
    const statusCode = error.statusCode ?? 500;
    return reply.status(statusCode).send({
      error: statusCode === 500 ? 'Erro interno do servidor' : error.message,
      reqId: request.id,
    });
  });

  // ── Plugins ───────────────────────────────────────────────────────────────
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      // Servico interno: apenas origens do mesmo cluster/gateway
      const allowed = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3333').split(',').map((o) => o.trim());
      if (allowed.includes(origin)) return cb(null, true);
      cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
  });

  await app.register(helmet);

  await app.register(rateLimit, {
    max:        env.rateLimitMax,
    timeWindow: '1 minute',
    errorResponseBuilder: (_req, ctx) => ({
      error:       'Muitas requisicoes. Tente novamente em breve.',
      code:        'RATE_LIMIT',
      retryAfter:  ctx.after,
    }),
  });

  // ── Health checks ─────────────────────────────────────────────────────────
  app.get('/health', { config: { rateLimit: false } }, async () => ({
    status:        'ok',
    timestamp:     new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
  }));

  app.get('/health/ready', { config: { rateLimit: false } }, async (_req, reply) => {
    let dbOk = false;
    let dbLatencyMs = 0;

    const start = process.hrtime.bigint();
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbOk = true;
      dbLatencyMs = Math.round(Number(process.hrtime.bigint() - start) / 1e6);
    } catch {
      dbLatencyMs = Math.round(Number(process.hrtime.bigint() - start) / 1e6);
    }

    const status = dbOk ? 'ok' : 'degraded';
    return reply.status(dbOk ? 200 : 503).send({
      status,
      timestamp:     new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      checks: {
        database: { status: dbOk ? 'up' : 'down', latencyMs: dbLatencyMs },
      },
    });
  });

  // ── Metricas Prometheus ───────────────────────────────────────────────────
  app.get('/metrics', { config: { rateLimit: false } }, async (req, reply) => {
    if (env.metricsToken) {
      const customHeader = (req.headers['x-metrics-token'] as string) ?? '';
      const authHeader   = (req.headers['authorization'] as string) ?? '';
      const bearerToken  = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      if (customHeader !== env.metricsToken && bearerToken !== env.metricsToken) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
    } else if (env.isProd) {
      app.log.warn('/metrics exposto sem autenticacao. Defina METRICS_TOKEN.');
    }
    reply.header('Content-Type', metricsContentType);
    return reply.send(await metricsText());
  });

  // ── Rotas de dominio ──────────────────────────────────────────────────────
  await app.register(notificationRoutes, { prefix: '/notifications' });

  return app;
}
