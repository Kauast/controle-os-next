import Fastify, { FastifyInstance, FastifyBaseLogger, FastifyRequest } from 'fastify';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { ZodError } from 'zod';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import staticPlugin from '@fastify/static';
import serviceOrderRoutes from './routes/serviceOrderRoutes';
import clientRoutes from './routes/clientRoutes';
import technicianRoutes from './routes/technicianRoutes';
import productRoutes from './routes/productRoutes';
import authRoutes from './routes/authRoutes';
import reportRoutes from './routes/reportRoutes';
import materialRequestRoutes from './routes/materialRequestRoutes';
import chipRoutes from './routes/chipRoutes';
import uploadRoutes from './routes/uploadRoutes';
import userRoutes from './routes/userRoutes';
import auditRoutes from './routes/auditRoutes';
import aiRoutes from './routes/aiRoutes';
import teamRoutes from './routes/teamRoutes';
import { AppError } from './lib/errors';
import { logger } from './lib/logger';
import { config } from './lib/config';
import { metricsText, metricsContentType } from './lib/metrics';
import { healthReport, livenessReport } from './lib/health';
import { registerObservability, logRequestError } from './plugins/observability';
import { redis } from './lib/cache';

// Decodifica payload JWT sem verificar assinatura — apenas para identificar o tenant no rate limit.
// A verificação real ocorre no middleware authenticate().
function rateLimitKey(req: FastifyRequest): string {
  const auth = (req.headers.authorization as string | undefined) ?? '';
  if (auth.startsWith('Bearer ')) {
    try {
      const [, b64] = auth.slice(7).split('.');
      const payload = JSON.parse(Buffer.from(b64, 'base64url').toString()) as Record<string, unknown>;
      if (typeof payload.companyId === 'string') return `c:${payload.companyId}`;
    } catch { /* não autenticado ou token malformado — cai no IP */ }
  }
  return `ip:${req.ip}`;
}

export async function buildApp(): Promise<FastifyInstance> {
  const isProd = config.isProd;

  const app = Fastify({
    // Cast para o tipo base do Fastify: mantém uma única instância pino compartilhada
    // (usada também por queue/prisma/startup) sem estreitar o tipo do logger nas rotas.
    loggerInstance: logger as unknown as FastifyBaseLogger,
    // Regra 1: Request ID por requisição. Reaproveita x-request-id do proxy/cliente
    // quando presente, senão gera um UUID — garante rastreabilidade ponta a ponta.
    genReqId: (req) => (req.headers['x-request-id'] as string) ?? randomUUID(),
    requestIdHeader: 'x-request-id',
    trustProxy: true,
    // O log estruturado de request/response é emitido pelo plugin de observabilidade.
    disableRequestLogging: true,
  });

  registerObservability(app);

  // Timeout global de requisições — protege workers contra requests pendurados
  app.addHook('onRequest', async (req, reply) => {
    if (req.url?.startsWith('/health') || req.url?.startsWith('/metrics')) return;
    const timer = setTimeout(() => {
      if (!reply.sent) {
        logger.warn({ event: 'request_timeout', reqId: req.id, url: req.url }, 'Timeout de requisição');
        reply.status(503).send({ error: 'Tempo de resposta esgotado', code: 'TIMEOUT', reqId: req.id });
      }
    }, config.requestTimeoutMs);
    reply.raw.on('finish', () => clearTimeout(timer));
    reply.raw.on('close',  () => clearTimeout(timer));
  });

  // Regras 2 + 3: todo erro vira log estruturado com stack trace completo.
  app.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
    logRequestError(request, error);

    if (error instanceof ZodError) {
      return reply.status(400).send({ error: 'Dados invalidos', details: error.issues, reqId: request.id });
    }
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ error: error.message, reqId: request.id });
    }
    const statusCode = error.statusCode ?? 500;
    reply.status(statusCode).send({
      error: statusCode === 500 ? 'Erro interno do servidor' : error.message,
      reqId: request.id,
    });
  });

  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim());

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

  await app.register(helmet, {
    ...(isProd
      ? {
          hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: false,
          },
        }
      : {}),
  });

  // Rate limit por empresa (companyId do JWT) — garante isolamento de cota entre tenants.
  // Requisições sem JWT (login, public) são limitadas por IP.
  await app.register(rateLimit, {
    max: config.rateLimitMax,
    timeWindow: '1 minute',
    keyGenerator: rateLimitKey,
    errorResponseBuilder: (_req, ctx) => ({
      error: 'Muitas requisições. Tente novamente em breve.',
      code: 'RATE_LIMIT',
      retryAfter: ctx.after,
    }),
    ...(isProd && redis ? { redis, nameSpace: 'rl:' } : {}),
  });

  await app.register(jwt, {
    secret: config.jwtSecret,
    sign: {
      expiresIn: config.jwtExpiresIn,
      iss: config.jwtIssuer,
      aud: config.jwtAudience,
    },
  });

  // Regra 4: liveness (processo vivo) e readiness (dependências OK).
  app.get('/health', { config: { rateLimit: false } }, async () => livenessReport());
  app.get('/health/ready', { config: { rateLimit: false } }, async (_req, reply) => {
    const report = await healthReport();
    return reply.status(report.status === 'ok' ? 200 : 503).send(report);
  });

  // Regra 7: endpoint de métricas no formato Prometheus.
  // Aceita token via: header x-metrics-token (nginx) OU Authorization: Bearer <token> (Prometheus).
  app.get('/metrics', { config: { rateLimit: false } }, async (req, reply) => {
    if (config.metricsToken) {
      const customHeader = (req.headers['x-metrics-token'] as string) ?? '';
      const authHeader   = (req.headers['authorization'] as string) ?? '';
      const bearerToken  = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      if (customHeader !== config.metricsToken && bearerToken !== config.metricsToken) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
    } else if (isProd) {
      app.log.warn('/metrics exposto sem autenticação. Defina METRICS_TOKEN no ambiente.');
    }
    reply.header('Content-Type', metricsContentType);
    return reply.send(await metricsText());
  });

  // Serve pasta de uploads (fotos, assinaturas)
  const uploadDir = process.env.UPLOAD_DIR ? join(process.cwd(), process.env.UPLOAD_DIR) : join(process.cwd(), 'uploads');
  if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
  await app.register(staticPlugin, {
    root: uploadDir,
    prefix: '/uploads/',
    decorateReply: false,
  });

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(serviceOrderRoutes, { prefix: '/api/service-orders' });
  await app.register(clientRoutes, { prefix: '/api/clients' });
  await app.register(technicianRoutes, { prefix: '/api/technicians' });
  await app.register(productRoutes, { prefix: '/api/products' });
  await app.register(reportRoutes, { prefix: '/api/reports' });
  await app.register(materialRequestRoutes, { prefix: '/api/material-requests' });
  await app.register(chipRoutes, { prefix: '/api/chips' });
  await app.register(uploadRoutes);
  await app.register(userRoutes, { prefix: '/api/users' });
  await app.register(auditRoutes, { prefix: '/api/audit' });
  await app.register(aiRoutes, { prefix: '/api/ai' });
  await app.register(teamRoutes, { prefix: '/api/teams' });

  return app;
}
