import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import { PrismaClient } from '@prisma/client';
import serviceOrderRoutes from './routes/serviceOrderRoutes';
import clientRoutes from './routes/clientRoutes';
import technicianRoutes from './routes/technicianRoutes';
import productRoutes from './routes/productRoutes';
import authRoutes from './routes/authRoutes';

export const prisma = new PrismaClient();

const start = async () => {
  const app = Fastify({ logger: true });

  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000,http://localhost:3001').split(',');
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
  });
  await app.register(helmet);
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
  await app.register(jwt, { secret: process.env.JWT_SECRET! });

  app.get('/health', async () => ({ status: 'ok', timestamp: new Date() }));

  await app.register(serviceOrderRoutes, { prefix: '/api/service-orders' });
  await app.register(clientRoutes, { prefix: '/api/clients' });
  await app.register(technicianRoutes, { prefix: '/api/technicians' });
  await app.register(productRoutes, { prefix: '/api/products' });
  await app.register(authRoutes, { prefix: '/api/auth' });

  app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
    app.log.error(error);
    const statusCode = error.statusCode ?? 500;
    reply.status(statusCode).send({
      error: statusCode === 500 ? 'Erro interno do servidor' : error.message,
    });
  });

  try {
    await app.listen({ port: Number(process.env.PORT) || 3333, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
