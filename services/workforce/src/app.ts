import Fastify, { FastifyInstance, FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import pino from 'pino';

import { env } from './env';
import { technicianRoutes } from './modules/technicians/technicians.routes';
import { teamRoutes } from './modules/teams/teams.routes';
import {
  httpRequestDuration,
  httpRequestsTotal,
  metricsText,
  metricsContentType,
  dependencyUp,
} from './lib/metrics';
import { prisma } from './lib/prisma';
import { AppError, UnauthorizedError } from './lib/errors';

const logger = pino({
  level: env.LOG_LEVEL,
  enabled: env.NODE_ENV !== 'test',
  base: { service: 'workforce-service', env: env.NODE_ENV, version: env.APP_VERSION },
  redact: { paths: ['req.headers.authorization', 'req.headers.cookie'], censor: '[REDACTED]' },
  formatters: { level: (label) => ({ level: label }) },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport:
    env.NODE_ENV === 'production' || env.NODE_ENV === 'test'
      ? undefined
      : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss.l' } },
});

type TimedRequest = FastifyRequest & { _startTime?: bigint };

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false, genReqId: () => crypto.randomUUID() });

  // ─── Security ───────────────────────────────────────────────────────────────
  app.register(helmet, { contentSecurityPolicy: false });
  app.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  app.register(rateLimit, { max: 300, timeWindow: '1 minute' });

  // ─── JWT ────────────────────────────────────────────────────────────────────
  app.register(jwt, { secret: env.JWT_SECRET });

  // ─── Observability hooks ────────────────────────────────────────────────────
  app.addHook('onRequest', async (req, reply) => {
    reply.header('x-request-id', req.id);
    (req as TimedRequest)._startTime = process.hrtime.bigint();
  });

  app.addHook('onResponse', async (req, reply) => {
    const start = (req as TimedRequest)._startTime;
    const seconds = start ? Number(process.hrtime.bigint() - start) / 1e9 : 0;
    const route = (req.routeOptions as { url?: string })?.url ?? req.url.split('?')[0];
    const labels = { method: req.method, route, status_code: String(reply.statusCode) };
    httpRequestDuration.observe(labels, seconds);
    httpRequestsTotal.inc(labels);
    logger.info({
      event: 'http_response',
      reqId: req.id,
      method: req.method,
      route,
      statusCode: reply.statusCode,
      durationMs: Math.round(seconds * 1000 * 100) / 100,
    });
  });

  // ─── Auth decorator ─────────────────────────────────────────────────────────
  app.decorate('authenticate', async (req: FastifyRequest) => {
    try {
      await req.jwtVerify();
    } catch {
      throw new UnauthorizedError('Token inválido ou ausente');
    }
  });

  // ─── Error handler global ───────────────────────────────────────────────────
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      return reply.status(err.statusCode).send({
        error: err.name,
        message: err.message,
        code: err.code,
      });
    }
    logger.error({ err, reqId: req.id }, 'Unhandled error');
    return reply.status(500).send({ error: 'InternalServerError', message: 'Erro interno' });
  });

  // ─── Health ─────────────────────────────────────────────────────────────────
  app.get('/health', async (_req, reply) => {
    return reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
    });
  });

  app.get('/health/ready', async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      dependencyUp.set({ dependency: 'database' }, 1);
      return reply.send({ status: 'ready', database: 'up' });
    } catch (err) {
      dependencyUp.set({ dependency: 'database' }, 0);
      return reply.status(503).send({ status: 'not_ready', database: 'down' });
    }
  });

  // ─── Metrics ─────────────────────────────────────────────────────────────────
  app.get('/metrics', async (_req, reply) => {
    reply.header('Content-Type', metricsContentType);
    return reply.send(await metricsText());
  });

  // ─── Domain routes (JWT required) ────────────────────────────────────────────
  const authenticate = async (req: FastifyRequest) => {
    try {
      await req.jwtVerify();
    } catch {
      throw new UnauthorizedError('Token inválido ou ausente');
    }
  };

  app.register(
    async (protected_) => {
      protected_.addHook('onRequest', authenticate);
      protected_.register(technicianRoutes, { prefix: '/technicians' });
      protected_.register(teamRoutes, { prefix: '/teams' });
    },
  );

  return app;
}
