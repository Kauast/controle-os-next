import pino from 'pino';

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// Regra 3: logs estruturados em JSON (nunca texto livre em produção).
// pino-pretty só em desenvolvimento, para leitura humana.
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),
  enabled: !isTest,
  base: {
    service: 'controle-os-api',
    env: process.env.NODE_ENV ?? 'development',
    version: process.env.APP_VERSION ?? '1.0.0',
  },
  // Regra 2: nunca vazar segredos nos logs estruturados.
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.token',
      'req.body.refreshToken',
      '*.password',
    ],
    censor: '[REDACTED]',
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: isProd || isTest
    ? undefined
    : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss.l' } },
});

export type Logger = typeof logger;
