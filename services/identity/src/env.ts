import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3334),

  // Banco de dados isolado do Identity Service
  DATABASE_URL: z.string().min(1, 'DATABASE_URL obrigatória'),
  DIRECT_URL: z.string().optional(),

  // JWT — único emissor
  JWT_SECRET: z.string().min(32, 'JWT_SECRET deve ter ao menos 32 caracteres'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  JWT_ISSUER: z.string().default('identity-svc'),
  JWT_AUDIENCE: z.string().default('controle-os'),

  // SMTP (opcional — simula em dev)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z.string().default('false'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  // URL base do app (para links de reset de senha)
  APP_URL: z.string().url().optional(),

  // RabbitMQ (opcional — warns se ausente)
  RABBITMQ_URL: z.string().optional(),
  RABBITMQ_EXCHANGE: z.string().default('controle-os.events'),

  // Métricas
  METRICS_TOKEN: z.string().optional(),

  // Rate limit
  RATE_LIMIT_MAX: z.coerce.number().default(300),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().default(20),
  REQUEST_TIMEOUT_MS: z.coerce.number().default(30_000),

  // CORS
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),

  // Log
  LOG_LEVEL: z.string().default('info'),
  APP_VERSION: z.string().default('1.0.0'),
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  ');
    throw new Error(`Variáveis de ambiente inválidas:\n  ${missing}`);
  }

  // Validação extra: em produção APP_URL é obrigatória
  const env = result.data;
  if (env.NODE_ENV === 'production' && !env.APP_URL) {
    throw new Error('FATAL: APP_URL é obrigatória em produção (previne Host Header Injection nos links de reset).');
  }

  return env;
}

export const env = parseEnv();
