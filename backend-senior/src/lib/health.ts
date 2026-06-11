import { prisma } from './prisma';
import { redis } from './cache';
import { dependencyUp } from './metrics';

type CheckResult = {
  status: 'up' | 'down';
  latencyMs: number;
  error?: string;
};

async function timed(fn: () => Promise<unknown>): Promise<CheckResult> {
  const start = process.hrtime.bigint();
  try {
    await fn();
    return { status: 'up', latencyMs: round(start) };
  } catch (err) {
    return { status: 'down', latencyMs: round(start), error: (err as Error).message };
  }
}

function round(start: bigint): number {
  return Math.round(Number(process.hrtime.bigint() - start) / 1e6 * 100) / 100;
}

async function checkDatabase(): Promise<CheckResult> {
  const r = await timed(() => prisma.$queryRaw`SELECT 1`);
  dependencyUp.set({ dependency: 'database' }, r.status === 'up' ? 1 : 0);
  return r;
}

async function checkRedis(): Promise<CheckResult> {
  const r = await timed(() => redis.ping());
  dependencyUp.set({ dependency: 'redis' }, r.status === 'up' ? 1 : 0);
  return r;
}

// Regra 4: health check com status detalhado de cada dependência.
export async function healthReport() {
  const [database, cache] = await Promise.all([checkDatabase(), checkRedis()]);
  const allUp = database.status === 'up' && cache.status === 'up';

  return {
    status: allUp ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    env: process.env.NODE_ENV ?? 'development',
    version: process.env.APP_VERSION ?? '1.0.0',
    checks: { database, cache },
    memory: {
      rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    },
  };
}

// Liveness: o processo está vivo? (sem tocar dependências)
export function livenessReport() {
  return { status: 'ok', timestamp: new Date().toISOString(), uptimeSeconds: Math.round(process.uptime()) };
}
