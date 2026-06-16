import pino from 'pino';
import { env } from '../env';

const isProd = env.NODE_ENV === 'production';
const isTest = env.NODE_ENV === 'test';

export const logger = pino({
  level: env.LOG_LEVEL,
  enabled: !isTest,
  base: {
    service: 'customer-service',
    env: env.NODE_ENV,
    version: env.APP_VERSION,
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      '*.password',
    ],
    censor: '[REDACTED]',
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport:
    isProd || isTest
      ? undefined
      : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss.l' } },
});

export type Logger = typeof logger;
