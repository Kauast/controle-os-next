import 'dotenv/config';

const REQUIRED = ['DATABASE_URL', 'RABBITMQ_URL'] as const;

export function validateEnv(): void {
  const missing = REQUIRED.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(
      `Variaveis de ambiente obrigatorias ausentes: ${missing.join(', ')}\n` +
      'Consulte services/notification/.env.example para a lista completa.',
    );
  }
}

export const env = {
  nodeEnv:        process.env.NODE_ENV ?? 'development',
  port:           Number(process.env.PORT ?? 3334),
  isProd:         process.env.NODE_ENV === 'production',
  isTest:         process.env.NODE_ENV === 'test',
  logLevel:       process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  appVersion:     process.env.APP_VERSION ?? '1.0.0',

  rabbitmqUrl:         process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672',
  rabbitmqExchange:    process.env.RABBITMQ_EXCHANGE ?? 'controle-os-events',
  rabbitmqQueue:       process.env.RABBITMQ_QUEUE ?? 'notification-service',
  rabbitmqRetryQueue:  process.env.RABBITMQ_RETRY_QUEUE ?? 'notification.retry',
  rabbitmqPrefetch:    Number(process.env.RABBITMQ_PREFETCH ?? 10),

  smtpHost:   process.env.SMTP_HOST,
  smtpPort:   Number(process.env.SMTP_PORT ?? 587),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser:   process.env.SMTP_USER,
  smtpPass:   process.env.SMTP_PASS,
  smtpFrom:   process.env.SMTP_FROM ?? process.env.SMTP_USER ?? 'noreply@controle-os.app',

  metricsToken: process.env.METRICS_TOKEN,
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? (process.env.NODE_ENV === 'production' ? 300 : 10_000)),

  retryDelayMs:  Number(process.env.RETRY_DELAY_MS ?? 120_000),
  maxRetryCount: Number(process.env.MAX_RETRY_COUNT ?? 3),
} as const;
