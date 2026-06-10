import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import serviceOrderRoutes from './routes/serviceOrderRoutes';
import clientRoutes from './routes/clientRoutes';
import technicianRoutes from './routes/technicianRoutes';
import productRoutes from './routes/productRoutes';
import authRoutes from './routes/authRoutes';
import reportRoutes from './routes/reportRoutes';
import materialRequestRoutes from './routes/materialRequestRoutes';
import chipRoutes from './routes/chipRoutes';

export async function buildApp(): Promise<FastifyInstance> {
  const isTest = process.env.NODE_ENV === 'test';
  const app = Fastify({ logger: !isTest });

  // Error handler antes dos routes para garantir escopo correto no Fastify v5
  app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
    // ZodError — duck-typing pelo name, pois instanceof pode falhar com múltiplas instâncias
    const asAny = error as any;
    if (asAny?.name === 'ZodError') {
      return reply.status(400).send({ error: 'Dados inválidos', details: asAny.issues ?? asAny.errors });
    }
    if (!isTest) app.log.error(error);
    const statusCode = error.statusCode ?? 500;
    reply.status(statusCode).send({
      error: statusCode === 500 ? 'Erro interno do servidor' : error.message,
    });
  });

  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000').split(',');
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
  });
  await app.register(helmet);
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
  await app.register(jwt, { secret: process.env.JWT_SECRET ?? 'test-secret-only-for-tests' });

  app.get('/health', async () => ({ status: 'ok', timestamp: new Date() }));

  await app.register(serviceOrderRoutes, { prefix: '/api/service-orders' });
  await app.register(clientRoutes, { prefix: '/api/clients' });
  await app.register(technicianRoutes, { prefix: '/api/technicians' });
  await app.register(productRoutes, { prefix: '/api/products' });
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(reportRoutes, { prefix: '/api/reports' });
  await app.register(materialRequestRoutes, { prefix: '/api/material-requests' });
  await app.register(chipRoutes, { prefix: '/api/chips' });

  return app;
}
