import Fastify, { FastifyInstance, FastifyBaseLogger, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import { ZodError } from 'zod';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';

import { env } from './env';
import { AppError } from './lib/errors';
import { metricsText, metricsContentType, httpRequestDuration, httpRequestsTotal, dependencyUp } from './lib/metrics';
import { invoicesRoutes } from './modules/invoices/invoices.routes';
import { paymentsRoutes } from './modules/payments/payments.routes';
import { financialRoutes } from './modules/financial/financial.routes';
import { prisma } from './lib/prisma';

// ── Autenticação ──────────────────────────────────────────────────────────────
export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
  } catch (err: unknown) {
    const isExpired = err instanceof Error && err.message.includes('expired');
    return reply.status(401).send({
      error: isExpired ? 'Token expirado' : 'Não autorizado',
      code:  isExpired ? 'TOKEN_EXPIRED' : 'UNAUTHORIZED',
    });
  }
}

type Timed = FastifyRequest & { startTime?: bigint };

function routeLabel(req: FastifyRequest): string {
  return (req as { routeOptions?: { url?: string } }).routeOptions?.url ?? req.url.split('?')[0];
}

// ── Factory ───────────────────────────────────────────────────────────────────
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger:            false, // usamos pino direto via console para simplificar
    genReqId:          (req) => (req.headers['x-request-id'] as string) ?? randomUUID(),
    requestIdHeader:   'x-request-id',
    trustProxy:        true,
    disableRequestLogging: true,
  });

  // ── Observabilidade ───────────────────────────────────────────────────────
  app.addHook('onRequest', async (req, reply) => {
    reply.header('x-request-id', req.id);
    (req as Timed).startTime = process.hrtime.bigint();
  });

  app.addHook('onResponse', async (req, reply) => {
    const start = (req as Timed).startTime;
    const seconds = start ? Number(process.hrtime.bigint() - start) / 1e9 : 0;
    const labels  = {
      method:      req.method,
      route:       routeLabel(req),
      status_code: String(reply.statusCode),
    };
    httpRequestDuration.observe(labels, seconds);
    httpRequestsTotal.inc(labels);
  });

  // ── Timeout global ────────────────────────────────────────────────────────
  app.addHook('onRequest', async (req, reply) => {
    if (req.url?.startsWith('/health') || req.url?.startsWith('/metrics')) return;
    const timer = setTimeout(() => {
      if (!reply.sent) {
        reply.status(503).send({ error: 'Tempo de resposta esgotado', code: 'TIMEOUT', reqId: req.id });
      }
    }, env.requestTimeoutMs);
    reply.raw.on('finish', () => clearTimeout(timer));
    reply.raw.on('close',  () => clearTimeout(timer));
  });

  // ── Error handler ─────────────────────────────────────────────────────────
  app.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({ error: 'Dados inválidos', details: error.issues, reqId: request.id });
    }
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ error: error.message, reqId: request.id });
    }
    const status = error.statusCode ?? 500;
    console.error({ reqId: request.id, err: error.message, stack: error.stack });
    return reply.status(status).send({
      error: status === 500 ? 'Erro interno do servidor' : error.message,
      reqId: request.id,
    });
  });

  // ── Plugins ───────────────────────────────────────────────────────────────
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (env.allowedOrigins.includes(origin) || origin.startsWith('capacitor://')) {
        return cb(null, true);
      }
      cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
  });

  await app.register(helmet);

  await app.register(rateLimit, {
    max:        env.rateLimitMax,
    timeWindow: '1 minute',
    errorResponseBuilder: (_req, ctx) => ({
      error:      'Muitas requisições. Tente novamente em breve.',
      code:       'RATE_LIMIT',
      retryAfter: ctx.after,
    }),
  });

  await app.register(jwt, {
    secret:  env.jwtSecret,
    sign:    { expiresIn: env.jwtExpiresIn, iss: env.jwtIssuer, aud: env.jwtAudience },
  });

  // ── Health ────────────────────────────────────────────────────────────────
  app.get('/health', { config: { rateLimit: false } }, async () => ({
    status: 'ok',
    service: 'billing-service',
    timestamp: new Date().toISOString(),
  }));

  app.get('/health/ready', { config: { rateLimit: false } }, async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      dependencyUp.set({ dependency: 'postgres' }, 1);
      return reply.status(200).send({
        status: 'ok',
        dependencies: { postgres: 'up' },
      });
    } catch (err) {
      dependencyUp.set({ dependency: 'postgres' }, 0);
      return reply.status(503).send({
        status: 'degraded',
        dependencies: { postgres: 'down' },
        error: (err as Error).message,
      });
    }
  });

  // ── Métricas ──────────────────────────────────────────────────────────────
  app.get('/metrics', { config: { rateLimit: false } }, async (req, reply) => {
    if (env.metricsToken) {
      const custom = (req.headers['x-metrics-token'] as string) ?? '';
      const bearer = ((req.headers['authorization'] as string) ?? '').replace('Bearer ', '');
      if (custom !== env.metricsToken && bearer !== env.metricsToken) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
    }
    reply.header('Content-Type', metricsContentType);
    return reply.send(await metricsText());
  });

  // ── Rotas de negócio ──────────────────────────────────────────────────────
  await app.register(invoicesRoutes, { prefix: '/invoices' });
  await app.register(paymentsRoutes, { prefix: '/payments' });
  await app.register(financialRoutes, { prefix: '/financial' });

  return app;
}
