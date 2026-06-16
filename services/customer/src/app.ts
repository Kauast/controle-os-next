import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import { env } from './env';
import { logger } from './lib/logger';
import { AppError } from './lib/errors';
import { metricsText, metricsContentType, httpRequestDuration, httpRequestsTotal } from './lib/metrics';
import { prisma } from './lib/prisma';
import { dependencyUp } from './lib/metrics';
import { clientRoutes } from './modules/clients/clients.routes';

// Augment FastifyInstance to include authenticate decorator
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

function routeLabel(req: FastifyRequest): string {
  return (req as any).routeOptions?.url ?? req.url.split('?')[0];
}

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      ...(env.NODE_ENV === 'production' || env.NODE_ENV === 'test'
        ? {}
        : {
            transport: {
              target: 'pino-pretty',
              options: { colorize: true, translateTime: 'HH:MM:ss.l' },
            },
          }),
    },
    genReqId: () => crypto.randomUUID(),
  });

  // Security
  await app.register(fastifyHelmet, { global: true });

  await app.register(fastifyCors, {
    origin: env.NODE_ENV === 'production' ? false : true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await app.register(fastifyRateLimit, {
    max: 200,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Limite de requisicoes atingido. Aguarde antes de tentar novamente.',
    }),
  });

  // JWT — apenas verifica, não emite
  await app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
  });

  // Authenticate decorator
  app.decorate(
    'authenticate',
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        await req.jwtVerify();
      } catch (err) {
        reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Token invalido ou ausente',
        });
      }
    },
  );

  // Observability hooks
  app.addHook('onRequest', async (req, reply) => {
    reply.header('x-request-id', req.id);
    (req as any).startTime = process.hrtime.bigint();
  });

  app.addHook('onResponse', async (req, reply) => {
    const start = (req as any).startTime as bigint | undefined;
    const seconds = start ? Number(process.hrtime.bigint() - start) / 1e9 : 0;
    const labels = {
      method: req.method,
      route: routeLabel(req),
      status_code: String(reply.statusCode),
    };
    httpRequestDuration.observe(labels, seconds);
    httpRequestsTotal.inc(labels);
  });

  // Global error handler
  app.setErrorHandler((error, req, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        statusCode: error.statusCode,
        error: error.name,
        message: error.message,
        code: error.code,
      });
    }

    // Zod validation errors surfaced as FastifyError with validation property
    if ((error as any).validation) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Dados de entrada invalidos',
        details: (error as any).validation,
      });
    }

    req.log.error({ err: error, reqId: req.id }, 'Unhandled error');

    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Erro interno do servidor',
    });
  });

  // Health routes (sem autenticação)
  app.get('/health', async (_req, reply) => {
    return reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      service: 'customer-service',
      version: env.APP_VERSION,
    });
  });

  app.get('/health/ready', async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      dependencyUp.set({ dependency: 'database' }, 1);
      return reply.send({
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks: { database: 'up' },
      });
    } catch (err) {
      dependencyUp.set({ dependency: 'database' }, 0);
      return reply.status(503).send({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        checks: { database: 'down' },
        error: (err as Error).message,
      });
    }
  });

  // Metrics (sem autenticação — proteger via rede interna / ingress)
  app.get('/metrics', async (_req, reply) => {
    const metrics = await metricsText();
    return reply
      .header('Content-Type', metricsContentType)
      .send(metrics);
  });

  // Business routes
  await app.register(clientRoutes);

  return app;
}
