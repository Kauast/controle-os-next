import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

// Prisma mockado (padrão dos testes deste repo — integração real usa banco).
vi.mock('../src/lib/prisma', () => ({
  prisma: {
    user: { findFirst: vi.fn().mockResolvedValue({ passwordChangedAt: null, active: true }) },
    serviceOrder: { findFirst: vi.fn().mockResolvedValue(null) },
    $disconnect: vi.fn(),
  },
}));

import { buildApp } from '../src/app';
import { prisma } from '../src/lib/prisma';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});
beforeEach(() => {
  vi.mocked(prisma.user.findFirst).mockResolvedValue({ passwordChangedAt: null, active: true } as never);
  vi.mocked(prisma.serviceOrder.findFirst).mockResolvedValue(null as never);
});

function adminToken(): string {
  return app.jwt.sign({ id: 'u1', role: 'ADMIN', companyId: 'c1' });
}

describe('error handler', () => {
  it('401 sem token já inclui code (middleware authenticate)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/service-orders/x' });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toHaveProperty('code');
  });

  it('NotFoundError flui pelo setErrorHandler e inclui code NOT_FOUND', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/service-orders/inexistente',
      headers: { authorization: `Bearer ${adminToken()}` },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('NOT_FOUND');
  });
});
