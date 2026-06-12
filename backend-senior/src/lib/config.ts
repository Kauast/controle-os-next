const REQUIRED = ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET'] as const;

export function validateEnv(): void {
  const missing = REQUIRED.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(
      `Variáveis de ambiente obrigatórias ausentes: ${missing.join(', ')}\n` +
      `Consulte backend-senior/.env.example para a lista completa.`,
    );
  }
}

export const config = {
  nodeEnv:      process.env.NODE_ENV ?? 'development',
  port:         Number(process.env.PORT ?? 3333),
  isProd:       process.env.NODE_ENV === 'production',
  isTest:       process.env.NODE_ENV === 'test',
  jwtSecret:    process.env.JWT_SECRET ?? 'test-secret-only-for-tests',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  jwtIssuer:    process.env.JWT_ISSUER ?? 'controle-os-api',
  jwtAudience:  process.env.JWT_AUDIENCE ?? 'controle-os-client',
  metricsToken: process.env.METRICS_TOKEN,
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 30_000),
  rateLimitMax:     Number(process.env.RATE_LIMIT_MAX ?? (process.env.NODE_ENV === 'production' ? 300 : 10_000)),
  loginRateLimitMax: Number(process.env.LOGIN_RATE_LIMIT_MAX ?? 20),
};
