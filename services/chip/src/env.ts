import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3002),
  LOG_LEVEL: z.string().default('info'),
  APP_VERSION: z.string().default('1.0.0'),

  DATABASE_URL: z.string().url(),

  JWT_SECRET: z.string().min(16),

  RABBITMQ_URL: z.string().default('amqp://guest:guest@localhost:5672'),
  RABBITMQ_EXCHANGE: z.string().default('controle-os'),
  RABBITMQ_QUEUE_OS_COMPLETED: z.string().default('chip-service.os.completed'),
  RABBITMQ_QUEUE_CLIENT_DELETED: z.string().default('chip-service.client.deleted'),

  CORS_ORIGIN: z.string().default('http://localhost:3000'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Variáveis de ambiente inválidas:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
