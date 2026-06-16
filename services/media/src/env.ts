import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3340),
  DATABASE_URL: z.string().min(1),
  RABBITMQ_URL: z.string().default('amqp://guest:guest@localhost:5672'),
  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),

  // Local storage
  STORAGE_LOCAL_PATH: z.string().default('./uploads'),

  // S3 / MinIO
  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().default('controle-os-media'),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),

  // Limites de upload
  MAX_FILE_SIZE: z.coerce.number().default(10 * 1024 * 1024), // 10 MB
  ALLOWED_MIME_TYPES: z.string().default('image/jpeg,image/png,application/pdf'),

  // Observabilidade
  SERVICE_HOST: z.string().default('0.0.0.0'),
  METRICS_TOKEN: z.string().optional(),
  REQUEST_TIMEOUT_MS: z.coerce.number().default(30_000),
  RATE_LIMIT_MAX: z.coerce.number().default(300),

  // CORS
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),

  // Auth
  JWT_SECRET: z.string().min(1),
  JWT_ISSUER: z.string().default('controle-os-api'),
  JWT_AUDIENCE: z.string().default('controle-os-client'),
});

function parseEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Variáveis de ambiente inválidas ou ausentes:\n${missing}`);
  }
  return result.data;
}

export const env = parseEnv();
