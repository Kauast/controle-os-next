import Fastify, { FastifyInstance, FastifyBaseLogger, FastifyRequest } from 'fastify';
import { randomUUID } from 'crypto';
import { ZodError } from 'zod';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import { env } from './env';
import { logger } from './lib/logger';
import { JWT_CONFIG } from './lib/jwt';
import { metricsText, metricsContentType, httpRequestDuration, httpRequestsTotal } from './lib/metrics';
import { AppError } from './lib/errors';
import { registerHealthRoutes } from './plugins/health.plugin';
import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';

// Normaliza rota para evitar explosão de cardinalidade no Prometheus
function routeLabel(req: FastifyRequest): string {
  return (req as FastifyRequest & { routeOptions?: { url?: string } }).routeOptions?.url ?? req.url.split('?')[0];
}

// Decodifica companyId do JWT sem verificar assinatura — apenas para rate limit por tenant
function rateLimitKey(req: FastifyRequest): string {
  const auth = (req.headers.authorization as string | undefined) ?? '';
  if (auth.startsWith('Bearer ')) {
    try {
      const [, b64] = auth.slice(7).split('.');
      const payload = JSON.parse(Buffer.from(b64, 'base64url').toString()) as Record<string, unknown>;
      if (typeof payload.companyId === 'string') return `c:${payload.companyId}`;
    } catch { /* token malformado — cai no IP */ }
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

  // Observabilidade: request ID e métricas HTTP
  app.addHook('onRequest', async (req, reply) => {
    reply.header('x-request-id', req.id);
    (req as FastifyRequest & { startTime?: bigint }).startTime = process.hrtime.bigint();
  });

  app.addHook('onResponse', async (req, reply) => {
    const start = (req as FastifyRequest & { startTime?: bigint }).startTime;
    const seconds = start ? Number(process.hrtime.bigint() - start) / 1e9 : 0;
    const labels = {
      method: req.method,
      route: routeLabel(req),
      status_code: String(reply.statusCode),
    };
    httpRequestDuration.observe(labels, seconds);
    httpRequestsTotal.inc(labels);

    req.log.info(
      {
        event: 'http_response',
        reqId: req.id,
        method: req.method,
        route: routeLabel(req),
        statusCode: reply.statusCode,
        durationMs: Math.round(seconds * 1000 * 100) / 100,
        ip: req.ip,
      },
      'http_response',
    );
  });

  // Timeout global de requisições
  app.addHook('onRequest', async (req, reply) => {
    if (req.url?.startsWith('/health') || req.url?.startsWith('/metrics')) return;
    const timer = setTimeout(() => {
      if (!reply.sent) {
        logger.warn({ event: 'request_timeout', reqId: req.id, url: req.url }, 'Timeout de requisicao');
        reply.status(503).send({ error: 'Tempo de resposta esgotado', code: 'TIMEOUT', reqId: req.id });
      }
    }, env.REQUEST_TIMEOUT_MS);
    reply.raw.on('finish', () => clearTimeout(timer));
    reply.raw.on('close', () => clearTimeout(timer));
  });

  // Error handler global
  app.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
    request.log.error(
      {
        event: 'request_error',
        reqId: request.id,
        route: routeLabel(request),
        errName: error.name,
        errMessage: error.message,
        stack: error.stack,
      },
      'request_error',
    );

    if (error instanceof ZodError) {
      return reply.status(400).send({ error: 'Dados invalidos', details: error.issues, reqId: request.id });
    }
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ error: error.message, code: error.code, reqId: request.id });
    }

    const statusCode = error.statusCode ?? 500;
    return reply.status(statusCode).send({
      error: statusCode === 500 ? 'Erro interno do servidor' : error.message,
      reqId: request.id,
    });
  });

  // CORS
  const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
  const CAPACITOR_ORIGINS = ['https://app.guardiao', 'capacitor://app.guardiao'];

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin) || CAPACITOR_ORIGINS.includes(origin)) {
        return cb(null, true);
      }
      cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
  });

  // Helmet (segurança HTTP)
  await app.register(helmet, {
    ...(env.NODE_ENV === 'production'
      ? { hsts: { maxAge: 31536000, includeSubDomains: true, preload: false } }
      : {}),
  });

  // Rate limit global por empresa (ou IP para requests sem JWT)
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: '1 minute',
    keyGenerator: rateLimitKey,
    errorResponseBuilder: (_req, ctx) => ({
      error: 'Muitas requisicoes. Tente novamente em breve.',
      code: 'RATE_LIMIT',
      retryAfter: ctx.after,
    }),
  });

  // JWT — Identity Service é o único emissor
  await app.register(jwt, JWT_CONFIG);

  // Health checks
  await registerHealthRoutes(app);

  // Metrics (Prometheus)
  app.get('/metrics', { config: { rateLimit: false } }, async (req, reply) => {
    if (env.METRICS_TOKEN) {
      const customHeader = (req.headers['x-metrics-token'] as string) ?? '';
      const authHeader = (req.headers['authorization'] as string) ?? '';
      const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      if (customHeader !== env.METRICS_TOKEN && bearerToken !== env.METRICS_TOKEN) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
    } else if (env.NODE_ENV === 'production') {
      app.log.warn('/metrics exposto sem autenticacao. Defina METRICS_TOKEN no ambiente.');
    }
    reply.header('Content-Type', metricsContentType);
    return reply.send(await metricsText());
  });

  // Rotas de domínio
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(usersRoutes, { prefix: '/users' });

  return app;
}
