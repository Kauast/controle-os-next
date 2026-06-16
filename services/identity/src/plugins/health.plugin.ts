import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { dependencyUp } from '../lib/metrics';

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

export async function healthReport() {
  const database = await checkDatabase();
  const allUp = database.status === 'up';

  return {
    status: allUp ? 'ok' : 'degraded',
    service: 'identity-svc',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    env: process.env.NODE_ENV ?? 'development',
    version: process.env.APP_VERSION ?? '1.0.0',
    checks: { database },
    memory: {
      rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    },
  };
}

export function livenessReport() {
  return {
    status: 'ok',
    service: 'identity-svc',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
  };
}

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get('/health', { config: { rateLimit: false } }, async () => livenessReport());

  app.get('/health/ready', { config: { rateLimit: false } }, async (_req, reply) => {
    const report = await healthReport();
    return reply.status(report.status === 'ok' ? 200 : 503).send(report);
  });
}
