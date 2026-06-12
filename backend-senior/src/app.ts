import Fastify, { FastifyInstance, FastifyBaseLogger } from 'fastify';
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
import { AppError } from './lib/errors';
import { logger } from './lib/logger';
import { metricsText, metricsContentType } from './lib/metrics';
import { healthReport, livenessReport } from './lib/health';
import { registerObservability, logRequestError } from './plugins/observability';
import { redis } from './lib/cache';

export async function buildApp(): Promise<FastifyInstance> {
  const isProd = process.env.NODE_ENV === 'production';

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

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    allowList: [],
    keyGenerator: (req) => req.ip,
    ...(isProd && redis ? { redis, nameSpace: 'rl:' } : {}),
  });

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret && isProd) {
    throw new Error('JWT_SECRET não definido. Configure a variável de ambiente antes de iniciar em produção.');
  }

  const issuer = process.env.JWT_ISSUER || 'controle-os-api';
  const audience = process.env.JWT_AUDIENCE || 'controle-os-client';

  await app.register(jwt, {
    secret: jwtSecret ?? 'test-secret-only-for-tests',
    sign: {
      expiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
      iss: issuer,
      aud: audience,
    },
  });

  // Regra 4: liveness (processo vivo) e readiness (dependências OK).
  app.get('/health', { config: { rateLimit: false } }, async () => livenessReport());
  app.get('/health/ready', { config: { rateLimit: false } }, async (_req, reply) => {
    const report = await healthReport();
    return reply.status(report.status === 'ok' ? 200 : 503).send(report);
  });

  // Regra 7: endpoint de métricas no formato Prometheus.
  // Em produção, exige METRICS_TOKEN via header x-metrics-token.
  const metricsToken = process.env.METRICS_TOKEN;
  app.get('/metrics', { config: { rateLimit: false } }, async (req, reply) => {
    if (metricsToken) {
      const provided = (req.headers['x-metrics-token'] as string) ?? '';
      if (provided !== metricsToken) {
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

  return app;
}
