import { describe, it, expect, vi } from 'vitest';
import { buildApp } from '../src/app';

vi.mock('../src/lib/prisma', () => ({
  prisma: {
    // authenticate() usa findFirst para verificar passwordChangedAt/active
    user: {
      findFirst: vi.fn().mockResolvedValue({ passwordChangedAt: null, active: true }),
      findUnique: vi.fn(),
    },
    client: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    serviceOrder: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    technician: { findFirst: vi.fn().mockResolvedValue(null) },
    product: { findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
    $disconnect: vi.fn(),
  },
}));

type Role = 'ADMIN' | 'STOCK' | 'TECHNICIAN' | 'ATTENDANT' | 'FINANCIAL';

async function tokenFor(role: Role) {
  const app = await buildApp();
  return app.jwt.sign({ id: `id-${role}`, email: `${role.toLowerCase()}@test.com`, role });
}

describe('RBAC — Clientes', () => {
  it('TECHNICIAN não pode criar cliente (403)', async () => {
    const app = await buildApp();
    const token = await tokenFor('TECHNICIAN');
    const res = await app.inject({
      method: 'POST',
      url: '/api/clients',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'X', document: '000' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('FINANCIAL não pode criar cliente (403)', async () => {
    const app = await buildApp();
    const token = await tokenFor('FINANCIAL');
    const res = await app.inject({
      method: 'POST',
      url: '/api/clients',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'X', document: '000' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('ATTENDANT não pode deletar cliente (403)', async () => {
    const app = await buildApp();
    const token = await tokenFor('ATTENDANT');
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/clients/some-id',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('RBAC — Relatórios', () => {
  it('ATTENDANT não pode acessar /reports/finance (403)', async () => {
    const app = await buildApp();
    const token = await tokenFor('ATTENDANT');
    const res = await app.inject({
      method: 'GET',
      url: '/api/reports/finance',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('TECHNICIAN não pode acessar /reports/team (403)', async () => {
    const app = await buildApp();
    const token = await tokenFor('TECHNICIAN');
    const res = await app.inject({
      method: 'GET',
      url: '/api/reports/team',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('RBAC — Produtos', () => {
  it('ATTENDANT não pode criar produto (403)', async () => {
    const app = await buildApp();
    const token = await tokenFor('ATTENDANT');
    const res = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'X', sku: 'SKU-1', price: 10 },
    });
    expect(res.statusCode).toBe(403);
  });

  it('FINANCIAL não pode ajustar estoque (403)', async () => {
    const app = await buildApp();
    const token = await tokenFor('FINANCIAL');
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/products/some-id/stock',
      headers: { authorization: `Bearer ${token}` },
      payload: { quantity: 5, reason: 'teste' },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('RBAC — OS', () => {
  it('FINANCIAL não pode criar OS (403)', async () => {
    const app = await buildApp();
    const token = await tokenFor('FINANCIAL');
    const res = await app.inject({
      method: 'POST',
      url: '/api/service-orders',
      headers: { authorization: `Bearer ${token}` },
      payload: { clientId: 'x', dueDate: '2026-12-01', items: [] },
    });
    expect(res.statusCode).toBe(403);
  });

  it('STOCK não pode atualizar status de OS (403)', async () => {
    const app = await buildApp();
    const token = await tokenFor('STOCK');
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/service-orders/some-id/status',
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'IN_PROGRESS' },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('Rotas públicas', () => {
  it('GET /health retorna 200 sem auth', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
  });

  it('POST /api/auth/login aceita sem token', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'test@test.com', password: 'qualquer' },
    });
    // Retorna 401 por credenciais inválidas, não 403 por falta de token
    expect(res.statusCode).not.toBe(403);
  });
});
