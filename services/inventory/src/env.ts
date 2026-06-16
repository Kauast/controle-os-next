import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(3002),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  JWT_SECRET: z.string().min(16),
  JWT_ISSUER: z.string().default('controle-os'),
  JWT_AUDIENCE: z.string().default('controle-os-api'),
  RABBITMQ_URL: z.string().default('amqp://guest:guest@localhost:5672'),
  RABBITMQ_EXCHANGE: z.string().default('controle_os_events'),
  RABBITMQ_PREFETCH: z.coerce.number().default(10),
  RATE_LIMIT_MAX: z.coerce.number().default(200),
  REQUEST_TIMEOUT_MS: z.coerce.number().default(30000),
  METRICS_TOKEN: z.string().optional(),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Variaveis de ambiente invalidas:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
