import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Role } from '@prisma/client';
import { buildApp } from '../src/app';

vi.mock('../src/lib/prisma', () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    company: {
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $disconnect: vi.fn(),
  },
}));

import { prisma } from '../src/lib/prisma';

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      active: true,
      passwordChangedAt: null,
    } as never);
    vi.mocked(prisma.company.findUnique).mockResolvedValue({
      id: 'company-1',
      active: true,
      name: 'Empresa Teste',
    } as never);
  });

  it('retorna 401 sem token', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'novo@test.com', password: 'senha12345', role: 'ATTENDANT' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('retorna 403 para role ATTENDANT', async () => {
    const app = await buildApp();
    const token = app.jwt.sign({ id: 'u1', email: 'atend@test.com', role: 'ATTENDANT', companyId: 'company-1' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      headers: { authorization: `Bearer ${token}` },
      payload: { email: 'novo@test.com', password: 'senha12345', role: 'ATTENDANT' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('retorna 403 para role TECHNICIAN', async () => {
    const app = await buildApp();
    const token = app.jwt.sign({ id: 'u2', email: 'tec@test.com', role: 'TECHNICIAN', companyId: 'company-1' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      headers: { authorization: `Bearer ${token}` },
      payload: { email: 'novo@test.com', password: 'senha12345', role: 'TECHNICIAN' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('retorna 403 para role FINANCIAL', async () => {
    const app = await buildApp();
    const token = app.jwt.sign({ id: 'u3', email: 'fin@test.com', role: 'FINANCIAL', companyId: 'company-1' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      headers: { authorization: `Bearer ${token}` },
      payload: { email: 'novo@test.com', password: 'senha12345', role: 'ATTENDANT' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('ADMIN consegue criar usuário', async () => {
    vi.mocked(prisma.user.findFirst)
      .mockResolvedValueOnce({ active: true, passwordChangedAt: null } as never)
      .mockResolvedValueOnce(null as never);
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: 'new-id',
      email: 'novo@test.com',
      role: 'ATTENDANT' as Role,
      password: 'hashed',
      active: true,
      createdAt: new Date(),
    } as never);

    const app = await buildApp();
    const token = app.jwt.sign({ id: 'admin-id', email: 'admin@test.com', role: 'ADMIN', companyId: 'company-1' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        email: 'novo@test.com',
        password: 'senha12345',
        role: 'ATTENDANT',
        companyId: 'company-1',
      },
    });
    expect(res.statusCode).toBe(201);
  });
});

describe('POST /api/auth/login', () => {
  it('retorna 400 com body inválido', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'nao-e-email' },
    });
    expect(res.statusCode).toBe(400);
  });
});
