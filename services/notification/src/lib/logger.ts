import pino from 'pino';
import { env } from '../env';

export const logger = pino({
  level: env.logLevel,
  enabled: !env.isTest,
  base: {
    service: 'notification-service',
    env:     env.nodeEnv,
    version: env.appVersion,
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.smtpPass',
    ],
    censor: '[REDACTED]',
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport:
    env.isProd || env.isTest
      ? undefined
      : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss.l' } },
});

export type Logger = typeof logger;
