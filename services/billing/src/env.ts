import 'dotenv/config';

const REQUIRED = ['DATABASE_URL', 'JWT_SECRET', 'RABBITMQ_URL'] as const;

export function validateEnv(): void {
  const missing = REQUIRED.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(
      `[billing-service] Variáveis de ambiente obrigatórias ausentes: ${missing.join(', ')}\n` +
      `Consulte services/billing/.env.example para a lista completa.`,
    );
  }
}

export const env = {
  nodeEnv:          process.env.NODE_ENV ?? 'development',
  port:             Number(process.env.PORT ?? 3334),
  isProd:           process.env.NODE_ENV === 'production',
  databaseUrl:      process.env.DATABASE_URL!,
  jwtSecret:        process.env.JWT_SECRET ?? 'test-secret-only-for-tests',
  jwtExpiresIn:     process.env.JWT_EXPIRES_IN ?? '8h',
  jwtIssuer:        process.env.JWT_ISSUER ?? 'controle-os-api',
  jwtAudience:      process.env.JWT_AUDIENCE ?? 'controle-os-client',
  rabbitmqUrl:      process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672',
  rabbitmqExchange: process.env.RABBITMQ_EXCHANGE ?? 'controle_os',
  rabbitmqQueue:    process.env.RABBITMQ_QUEUE_BILLING ?? 'billing.events',
  metricsToken:     process.env.METRICS_TOKEN,
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 30_000),
  rateLimitMax:     Number(process.env.RATE_LIMIT_MAX ?? (process.env.NODE_ENV === 'production' ? 300 : 10_000)),
  allowedOrigins:   (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000').split(',').map((o) => o.trim()),
  overdueCron:      process.env.OVERDUE_CRON ?? '0 2 * * *',
};
