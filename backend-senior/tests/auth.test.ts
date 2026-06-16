import { describe, it, expect, vi } from 'vitest';
import type { Role } from '@prisma/client';
import { buildApp } from '../src/app';

// Prisma mockado para testes unitários — integração requer banco real
vi.mock('../src/lib/prisma', () => ({
  prisma: {
    user: {
      // authenticate() usa findFirst para verificar passwordChangedAt/active
      findFirst: vi.fn().mockResolvedValue({ passwordChangedAt: null, active: true }),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    company: {
      findFirst: vi.fn().mockResolvedValue({ id: 'company-1', active: true }),
    },
    refreshToken: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: 'rt-1', tokenHash: 'sha256hashvalue', userId: 'u1', expiresAt: new Date() }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    technician: { findFirst: vi.fn().mockResolvedValue(null) },
    $disconnect: vi.fn(),
  },
}));

import { prisma } from '../src/lib/prisma';

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restablece o comportamento padrão após clear: authenticate() precisa de user ativo
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ passwordChangedAt: null, active: true } as never);
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
    const token = app.jwt.sign({ id: 'u1', email: 'atend@test.com', role: 'ATTENDANT' });
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
    const token = app.jwt.sign({ id: 'u2', email: 'tec@test.com', role: 'TECHNICIAN' });
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
    const token = app.jwt.sign({ id: 'u3', email: 'fin@test.com', role: 'FINANCIAL' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      headers: { authorization: `Bearer ${token}` },
      payload: { email: 'novo@test.com', password: 'senha12345', role: 'ATTENDANT' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('ADMIN consegue criar usuário', async () => {
    // findFirst: primeira chamada = auth middleware (retorna user ativo), segunda = verifica duplicidade (retorna null)
    vi.mocked(prisma.user.findFirst)
      .mockResolvedValueOnce({ passwordChangedAt: null, active: true } as never)
      .mockResolvedValueOnce(null); // sem duplicata
    vi.mocked(prisma.company.findFirst).mockResolvedValue({ id: 'company-1', active: true } as never);
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: 'new-id',
      name: null,
      email: 'novo@test.com',
      role: 'ATTENDANT' as Role,
      companyId: 'company-1',
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
      // companyId obrigatório no registerSchema (o controller do registro usa body, não token)
      payload: { email: 'novo@test.com', password: 'senha12345', role: 'ATTENDANT', companyId: 'company-1' },
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
