import 'dotenv/config';
import Fastify, { FastifyInstance, FastifyBaseLogger, FastifyRequest } from 'fastify';
import { randomUUID } from 'crypto';
import { ZodError } from 'zod';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import serviceOrderRoutes from './modules/service-orders/service-orders.routes';
import { AppError } from './lib/errors';
import { env } from './env';
import { metricsText, metricsContentType } from './lib/metrics';
import { prisma } from './lib/prisma';
import pino from 'pino';

const logger = pino({
  level: env.logLevel,
  transport: env.isProd ? undefined : { target: 'pino-pretty', options: { colorize: true } },
});

function rateLimitKey(req: FastifyRequest): string {
  const auth = (req.headers.authorization as string | undefined) ?? '';
  if (auth.startsWith('Bearer ')) {
    try {
      const [, b64] = auth.slice(7).split('.');
      const payload = JSON.parse(Buffer.from(b64, 'base64url').toString()) as Record<string, unknown>;
      if (typeof payload.companyId === 'string') return `c:${payload.companyId}`;
    } catch { /* cai no IP */ }
  }
  return `ip:${req.ip}`;
}

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    loggerInstance: logger as unknown as FastifyBaseLogger,
    genReqId: (req) => (req.headers['x-request-id'] as string) ?? randomUUID(),
    requestIdHeader: 'x-request-id',
    trustProxy: true,
    disableRequestLogging: true,
  });

  // Timeout global
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

  // Log estruturado por requisição
  app.addHook('onResponse', (req, reply, done) => {
    logger.info({
      reqId:   req.id,
      method:  req.method,
      url:     req.url,
      status:  reply.statusCode,
      ms:      reply.elapsedTime.toFixed(2),
    }, 'request');
    done();
  });

  // Error handler global
  app.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error:   'Dados inválidos',
        code:    'VALIDATION_ERROR',
        details: error.issues,
        reqId:   request.id,
      });
    }
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: error.message,
        code:  error.code,
        reqId: request.id,
      });
    }
    logger.error({ reqId: request.id, err: error }, 'Erro não tratado');
    const statusCode = error.statusCode ?? 500;
    reply.status(statusCode).send({
      error: statusCode === 500 ? 'Erro interno do servidor' : error.message,
      reqId: request.id,
    });
  });

  // CORS
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

  // Helmet
  await app.register(helmet, {
    ...(env.isProd ? { hsts: { maxAge: 31536000, includeSubDomains: true } } : {}),
  });

  // Rate limit
  await app.register(rateLimit, {
    max: env.rateLimitMax,
    timeWindow: '1 minute',
    keyGenerator: rateLimitKey,
    errorResponseBuilder: (_req, ctx) => ({
      error: 'Muitas requisições. Tente novamente em breve.',
      code: 'RATE_LIMIT',
      retryAfter: ctx.after,
    }),
  });

  // JWT (apenas valida — não emite)
  await app.register(jwt, {
    secret: env.jwtSecret,
    verify: {
      issuer:   env.jwtIssuer,
      audience: env.jwtAudience,
    },
  });

  // ── Health endpoints ────────────────────────────────────────────────────
  app.get('/health', { config: { rateLimit: false } }, async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
  }));

  app.get('/health/ready', { config: { rateLimit: false } }, async (_req, reply) => {
    let dbOk = false;
    let dbLatencyMs = 0;
    try {
      const start = process.hrtime.bigint();
      await (prisma as unknown as { $queryRaw: Function }).$queryRaw`SELECT 1`;
      dbLatencyMs = Math.round(Number(process.hrtime.bigint() - start) / 1e6);
      dbOk = true;
    } catch { /* db down */ }

    const status = dbOk ? 'ok' : 'degraded';
    return reply.status(dbOk ? 200 : 503).send({
      status,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      version: env.appVersion,
      checks: {
        database: { status: dbOk ? 'up' : 'down', latencyMs: dbLatencyMs },
      },
    });
  });

  // Métricas Prometheus
  app.get('/metrics', { config: { rateLimit: false } }, async (req, reply) => {
    if (env.metricsToken) {
      const header = (req.headers['x-metrics-token'] as string) ?? '';
      const bearer = (req.headers.authorization as string ?? '').replace('Bearer ', '');
      if (header !== env.metricsToken && bearer !== env.metricsToken) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
    }
    reply.header('Content-Type', metricsContentType);
    return reply.send(await metricsText());
  });

  // Rotas de negócio
  await app.register(serviceOrderRoutes, { prefix: '/service-orders' });

  return app;
}
