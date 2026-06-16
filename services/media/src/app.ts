import Fastify, { FastifyInstance, FastifyRequest } from 'fastify';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { ZodError } from 'zod';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import staticPlugin from '@fastify/static';
import attachmentsRoutes from './modules/attachments/attachments.routes';
import { AppError } from './lib/errors';
import { metricsText, metricsContentType, httpRequestDuration, httpRequestsTotal } from './lib/metrics';
import { env } from './env';
import { prisma } from './lib/prisma';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function routeLabel(req: FastifyRequest): string {
  return (req as FastifyRequest & { routeOptions?: { url?: string } }).routeOptions?.url ?? req.url.split('?')[0];
}

type Timed = FastifyRequest & { _startTime?: bigint };

// ---------------------------------------------------------------------------
// App factory
// ---------------------------------------------------------------------------

export async function buildApp(): Promise<FastifyInstance> {
  const isProd = env.NODE_ENV === 'production';

  const app = Fastify({
    genReqId: (req) => (req.headers['x-request-id'] as string) ?? randomUUID(),
    requestIdHeader: 'x-request-id',
    trustProxy: true,
    disableRequestLogging: true,
  });

  // Observabilidade: request ID em toda resposta + métricas HTTP
  app.addHook('onRequest', async (req, reply) => {
    reply.header('x-request-id', req.id);
    (req as Timed)._startTime = process.hrtime.bigint();
  });

  app.addHook('onResponse', async (req, reply) => {
    const start = (req as Timed)._startTime;
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

  // Timeout global — protege contra requests pendurados
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

  // Error handler global
  app.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
    request.log.error(
      { event: 'request_error', reqId: request.id, errName: error.name, errMessage: error.message, stack: error.stack },
      'request_error',
    );

    if (error instanceof ZodError) {
      return reply.status(400).send({ error: 'Dados inválidos', details: error.issues, reqId: request.id });
    }
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ error: error.message, code: error.code, reqId: request.id });
    }
    const status = error.statusCode ?? 500;
    return reply.status(status).send({
      error: status === 500 ? 'Erro interno do servidor' : error.message,
      reqId: request.id,
    });
  });

  // CORS
  const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
  });

  // Helmet
  await app.register(helmet, isProd ? { hsts: { maxAge: 31536000, includeSubDomains: true } } : {});

  // Rate limit
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: '1 minute',
    keyGenerator: (req) => {
      const auth = (req.headers.authorization as string | undefined) ?? '';
      if (auth.startsWith('Bearer ')) {
        try {
          const [, b64] = auth.slice(7).split('.');
          const payload = JSON.parse(Buffer.from(b64, 'base64url').toString()) as Record<string, unknown>;
          if (typeof payload.companyId === 'string') return `c:${payload.companyId}`;
        } catch { /* cai no IP */ }
      }
      return `ip:${req.ip}`;
    },
    errorResponseBuilder: (_req, ctx) => ({
      error: 'Muitas requisições. Tente novamente em breve.',
      code: 'RATE_LIMIT',
      retryAfter: ctx.after,
    }),
  });

  // JWT
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { iss: env.JWT_ISSUER, aud: env.JWT_AUDIENCE },
  });

  // ---------------------------------------------------------------------------
  // Health & Metrics
  // ---------------------------------------------------------------------------

  app.get('/health', { config: { rateLimit: false } }, async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
  }));

  app.get('/health/ready', { config: { rateLimit: false } }, async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return reply.send({ status: 'ok', timestamp: new Date().toISOString() });
    } catch (err) {
      return reply.status(503).send({
        status: 'degraded',
        timestamp: new Date().toISOString(),
        error: (err as Error).message,
      });
    }
  });

  app.get('/metrics', { config: { rateLimit: false } }, async (req, reply) => {
    if (env.METRICS_TOKEN) {
      const customHeader = (req.headers['x-metrics-token'] as string) ?? '';
      const authHeader = (req.headers['authorization'] as string) ?? '';
      const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      if (customHeader !== env.METRICS_TOKEN && bearer !== env.METRICS_TOKEN) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
    }
    reply.header('Content-Type', metricsContentType);
    return reply.send(await metricsText());
  });

  // ---------------------------------------------------------------------------
  // Static (local storage)
  // ---------------------------------------------------------------------------

  if (env.STORAGE_PROVIDER === 'local') {
    const uploadDir = join(process.cwd(), env.STORAGE_LOCAL_PATH);
    if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
    await app.register(staticPlugin, {
      root: uploadDir,
      prefix: '/static/',
      decorateReply: false,
    });
  }

  // ---------------------------------------------------------------------------
  // Rotas de domínio
  // ---------------------------------------------------------------------------

  await app.register(attachmentsRoutes, { prefix: '/attachments' });

  return app;
}
