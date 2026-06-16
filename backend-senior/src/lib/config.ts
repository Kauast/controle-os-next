const REQUIRED = ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET'] as const;

export function validateEnv(): void {
  const missing = REQUIRED.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(
      `Variáveis de ambiente obrigatórias ausentes: ${missing.join(', ')}\n` +
      `Consulte backend-senior/.env.example para a lista completa.`,
    );
  }

  // ETAPA 2: METRICS_TOKEN obrigatório em produção — expor /metrics sem token vaza dados de infra
  if (process.env.NODE_ENV === 'production' && !process.env.METRICS_TOKEN) {
    throw new Error(
      'FATAL: METRICS_TOKEN não definido. Em produção o endpoint /metrics deve ser protegido. ' +
      'Defina METRICS_TOKEN no ambiente ou desative o endpoint.',
    );
  }

  // ETAPA 3: APP_URL obrigatória em produção e deve ser URL válida
  const appUrl = process.env.APP_URL;
  if (process.env.NODE_ENV === 'production') {
    if (!appUrl) {
      throw new Error(
        'FATAL: APP_URL não definida. Em produção esta variável é obrigatória ' +
        'para geração segura de links de reset de senha (previne Host Header Injection).',
      );
    }
    try {
      new URL(appUrl);
    } catch {
      throw new Error(`FATAL: APP_URL inválida: "${appUrl}". Deve ser uma URL completa (ex: https://seu-dominio.com).`);
    }
  } else if (appUrl) {
    // Em dev/test: se definida, valida mesmo assim
    try {
      new URL(appUrl);
    } catch {
      throw new Error(`APP_URL inválida: "${appUrl}". Deve ser uma URL completa.`);
    }
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
