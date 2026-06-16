import 'dotenv/config';

const REQUIRED = ['DATABASE_URL', 'JWT_SECRET', 'RABBITMQ_URL'] as const;

export function validateEnv(): void {
  const missing = REQUIRED.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(
      `Variáveis de ambiente obrigatórias ausentes: ${missing.join(', ')}\n` +
      `Consulte .env.example para a lista completa.`,
    );
  }
}

export const env = {
  nodeEnv:            process.env.NODE_ENV ?? 'development',
  port:               Number(process.env.PORT ?? 3334),
  isProd:             process.env.NODE_ENV === 'production',
  jwtSecret:          process.env.JWT_SECRET ?? 'dev-secret',
  jwtIssuer:          process.env.JWT_ISSUER ?? 'controle-os-api',
  jwtAudience:        process.env.JWT_AUDIENCE ?? 'controle-os-client',
  metricsToken:       process.env.METRICS_TOKEN,
  logLevel:           process.env.LOG_LEVEL ?? 'info',
  requestTimeoutMs:   Number(process.env.REQUEST_TIMEOUT_MS ?? 30_000),
  rateLimitMax:       Number(process.env.RATE_LIMIT_MAX ?? (process.env.NODE_ENV === 'production' ? 300 : 10_000)),
  rabbitmqUrl:        process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672',
  rabbitmqExchange:   process.env.RABBITMQ_EXCHANGE ?? 'os-events',
  rabbitmqDlq:        process.env.RABBITMQ_QUEUE_DLQ ?? 'os-events.dlq',
  customerSvcUrl:     process.env.CUSTOMER_SVC_URL ?? 'http://localhost:3335',
  workforceSvcUrl:    process.env.WORKFORCE_SVC_URL ?? 'http://localhost:3336',
  inventorySvcUrl:    process.env.INVENTORY_SVC_URL ?? 'http://localhost:3337',
  chipSvcUrl:         process.env.CHIP_SVC_URL ?? 'http://localhost:3338',
  cbTimeoutMs:        Number(process.env.CB_TIMEOUT_MS ?? 3_000),
  cbErrorThreshold:   Number(process.env.CB_ERROR_THRESHOLD ?? 50),
  cbResetTimeoutMs:   Number(process.env.CB_RESET_TIMEOUT_MS ?? 10_000),
  allowedOrigins:     (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000').split(',').map((o) => o.trim()),
  appVersion:         process.env.APP_VERSION ?? '1.0.0',
};
