import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';

// Store in-memory simulando a tabela IdempotencyKey.
const store = new Map<string, Record<string, unknown>>();

vi.mock('../src/lib/prisma', () => ({
  prisma: {
    idempotencyKey: {
      findUnique: vi.fn(async ({ where }: { where: { companyId_key: { companyId: string; key: string } } }) => {
        const { companyId, key } = where.companyId_key;
        return store.get(`${companyId}|${key}`) ?? null;
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const k = `${data.companyId}|${data.key}`;
        if (store.has(k)) throw new Error('duplicate');
        store.set(k, data);
        return data;
      }),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
  },
}));

import { registerIdempotency, cleanupExpiredIdempotencyKeys } from '../src/plugins/idempotency';

async function buildTestApp(): Promise<{ app: FastifyInstance; getCount: () => number }> {
  const app = Fastify();
  let counter = 0;
  registerIdempotency(app);
  app.post('/test', async () => {
    counter += 1;
    return { counter };
  });
  app.setErrorHandler((err: Error & { statusCode?: number; code?: string }, _req, reply) => {
    reply.status(err.statusCode ?? 500).send({ error: err.message, code: err.code });
  });
  await app.ready();
  return { app, getCount: () => counter };
}

beforeEach(() => store.clear());

describe('idempotency plugin', () => {
  it('reenvio com a mesma chave não reexecuta o handler e replica a resposta', async () => {
    const { app, getCount } = await buildTestApp();
    const headers = { 'idempotency-key': 'k1' };
    const r1 = await app.inject({ method: 'POST', url: '/test', headers, payload: { a: 1 } });
    const r2 = await app.inject({ method: 'POST', url: '/test', headers, payload: { a: 1 } });
    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200);
    expect(getCount()).toBe(1);
    expect(r2.json()).toEqual(r1.json());
    expect(r2.headers['idempotent-replayed']).toBe('true');
    await app.close();
  });

  it('mesma chave com payload diferente retorna 422 IDEMPOTENCY_KEY_REUSE', async () => {
    const { app } = await buildTestApp();
    const headers = { 'idempotency-key': 'k2' };
    await app.inject({ method: 'POST', url: '/test', headers, payload: { a: 1 } });
    const r = await app.inject({ method: 'POST', url: '/test', headers, payload: { a: 2 } });
    expect(r.statusCode).toBe(422);
    expect(r.json().code).toBe('IDEMPOTENCY_KEY_REUSE');
    await app.close();
  });

  it('sem header de idempotência, cada request executa normalmente', async () => {
    const { app, getCount } = await buildTestApp();
    await app.inject({ method: 'POST', url: '/test', payload: {} });
    await app.inject({ method: 'POST', url: '/test', payload: {} });
    expect(getCount()).toBe(2);
    await app.close();
  });

  it('cleanupExpiredIdempotencyKeys chama deleteMany e retorna a contagem', async () => {
    const count = await cleanupExpiredIdempotencyKeys();
    expect(count).toBe(0);
  });
});
