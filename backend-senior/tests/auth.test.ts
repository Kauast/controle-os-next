import { describe, it, expect, vi } from 'vitest';
import type { Role } from '@prisma/client';
import { buildApp } from '../src/app';

// Prisma mockado para testes unitários — integração requer banco real
vi.mock('../src/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    $disconnect: vi.fn(),
  },
}));

import { prisma } from '../src/lib/prisma';

describe('POST /api/auth/register', () => {
  beforeEach(() => vi.clearAllMocks());

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
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: 'new-id',
      email: 'novo@test.com',
      role: 'ATTENDANT' as Role,
      password: 'hashed',
      active: true,
      createdAt: new Date(),
    });

    const app = await buildApp();
    const token = app.jwt.sign({ id: 'admin-id', email: 'admin@test.com', role: 'ADMIN' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      headers: { authorization: `Bearer ${token}` },
      payload: { email: 'novo@test.com', password: 'senha12345', role: 'ATTENDANT' },
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
