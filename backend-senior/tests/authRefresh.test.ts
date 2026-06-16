import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { AuthService } from '../src/modules/auth/auth.service';

// ─── Mock do módulo prisma ────────────────────────────────────────────────────
// Intercepta antes que qualquer import real ocorra.
vi.mock('../src/lib/prisma', () => {
  const mockRefreshToken = {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
  };
  return {
    prisma: {
      refreshToken: mockRefreshToken,
    },
    Prisma: {},
  };
});

// ─── Mock do módulo de audit ──────────────────────────────────────────────────
vi.mock('../src/modules/audit/audit.service', () => ({
  audit: vi.fn().mockResolvedValue(undefined),
}));

// ─── Mock do email ────────────────────────────────────────────────────────────
vi.mock('../src/lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  buildPasswordResetEmail: vi.fn().mockReturnValue(''),
}));

// Importa após os mocks estarem registrados
import { prisma } from '../src/lib/prisma';

// Helpers para reduzir repetição
const mockFindUnique = prisma.refreshToken.findUnique as ReturnType<typeof vi.fn>;
const mockUpdate = prisma.refreshToken.update as ReturnType<typeof vi.fn>;
const mockUpdateMany = prisma.refreshToken.updateMany as ReturnType<typeof vi.fn>;
const mockCreate = prisma.refreshToken.create as ReturnType<typeof vi.fn>;
const mockCount = prisma.refreshToken.count as ReturnType<typeof vi.fn>;

const NOW = new Date();
const FUTURE = new Date(NOW.getTime() + 7 * 24 * 60 * 60_000);
const PAST = new Date(NOW.getTime() - 1000);

/** Calcula o SHA-256 hex de uma string — igual ao helper privado do AuthService. */
function sha256(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

const RAW_TOKEN = 'original-token-abc';
const HASHED_TOKEN = sha256(RAW_TOKEN);

const baseUser = {
  id: 'user-1',
  name: 'Teste',
  email: 'teste@example.com',
  role: 'ATTENDANT',
  companyId: 'company-1',
  active: true,
  company: { id: 'company-1', active: true },
};

function makeRecord(overrides: Partial<{
  revokedAt: Date | null;
  expiresAt: Date;
  userActive: boolean;
  companyActive: boolean;
}> = {}) {
  return {
    id: 'rt-1',
    tokenHash: HASHED_TOKEN,
    userId: 'user-1',
    expiresAt: overrides.expiresAt ?? FUTURE,
    revokedAt: overrides.revokedAt ?? null,
    createdAt: NOW,
    user: {
      ...baseUser,
      active: overrides.userActive ?? true,
      company: { ...baseUser.company, active: overrides.companyActive ?? true },
    },
  };
}

describe('AuthService.rotateRefreshToken', () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService();
    vi.clearAllMocks();
  });

  // ─── Caso feliz ──────────────────────────────────────────────────────────────

  it('retorna novo refreshToken (diferente do original) e dados do usuário em rotação válida', async () => {
    mockFindUnique.mockResolvedValueOnce(makeRecord());
    mockUpdate.mockResolvedValueOnce({});
    mockCount.mockResolvedValueOnce(0);
    mockCreate.mockImplementationOnce(({ data }: { data: { tokenHash: string } }) =>
      Promise.resolve({ id: 'rt-2', tokenHash: data.tokenHash }),
    );

    const result = await service.rotateRefreshToken(RAW_TOKEN);

    expect(result.refreshToken).toBeDefined();
    expect(result.refreshToken).not.toBe(RAW_TOKEN);
    expect(result.user.id).toBe('user-1');
    expect(result.user.companyId).toBe('company-1');

    // Token original deve ter sido revogado pelo id do registro
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'rt-1' }, data: { revokedAt: expect.any(Date) } }),
    );

    // Banco deve ter sido consultado pelo HASH, nunca pelo token cru
    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: HASHED_TOKEN } }),
    );
  });

  it('carrega companyId correto do usuário no resultado (multi-tenant)', async () => {
    const record = makeRecord();
    record.user.companyId = 'company-xyz';
    mockFindUnique.mockResolvedValueOnce(record);
    mockUpdate.mockResolvedValueOnce({});
    mockCount.mockResolvedValueOnce(0);
    mockCreate.mockImplementationOnce(({ data }: { data: { tokenHash: string } }) =>
      Promise.resolve({ id: 'rt-3', tokenHash: data.tokenHash }),
    );

    const result = await service.rotateRefreshToken(RAW_TOKEN);
    expect(result.user.companyId).toBe('company-xyz');
  });

  // ─── Rejeições simples ───────────────────────────────────────────────────────

  it('lança 401 quando token não existe no banco', async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    await expect(service.rotateRefreshToken('token-fantasma')).rejects.toMatchObject({
      statusCode: 401,
      message: 'Refresh token inválido ou expirado',
    });
  });

  it('lança 401 quando token está expirado', async () => {
    mockFindUnique.mockResolvedValueOnce(makeRecord({ expiresAt: PAST }));

    await expect(service.rotateRefreshToken(RAW_TOKEN)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Refresh token inválido ou expirado',
    });
  });

  it('lança 401 e NÃO revela motivo diferente entre expirado e inválido', async () => {
    // Expirado
    mockFindUnique.mockResolvedValueOnce(makeRecord({ expiresAt: PAST }));
    const errExp = await service.rotateRefreshToken(RAW_TOKEN).catch((e) => e);

    // Não encontrado
    mockFindUnique.mockResolvedValueOnce(null);
    const errNf = await service.rotateRefreshToken('t').catch((e) => e);

    expect(errExp.message).toBe(errNf.message);
    expect(errExp.statusCode).toBe(errNf.statusCode);
  });

  it('lança 401 quando usuário está inativo', async () => {
    mockFindUnique.mockResolvedValueOnce(makeRecord({ userActive: false }));

    await expect(service.rotateRefreshToken(RAW_TOKEN)).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('lança 401 quando empresa está inativa', async () => {
    mockFindUnique.mockResolvedValueOnce(makeRecord({ companyActive: false }));

    await expect(service.rotateRefreshToken(RAW_TOKEN)).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  // ─── Após rotação: token antigo não deve funcionar mais ──────────────────────

  it('token rotacionado fica revogado — segunda tentativa com mesmo token retorna 401', async () => {
    // Primeira chamada: rotação bem-sucedida
    mockFindUnique.mockResolvedValueOnce(makeRecord());
    mockUpdate.mockResolvedValueOnce({});
    mockCount.mockResolvedValueOnce(0);
    mockCreate.mockImplementationOnce(({ data }: { data: { tokenHash: string } }) =>
      Promise.resolve({ id: 'rt-2', tokenHash: data.tokenHash }),
    );
    await service.rotateRefreshToken(RAW_TOKEN);

    // Segunda chamada: simula banco retornando o registro JÁ revogado
    mockFindUnique.mockResolvedValueOnce(makeRecord({ revokedAt: new Date() }));
    // Deve revogar todos os tokens do usuário como defesa de reuse
    mockUpdateMany.mockResolvedValueOnce({ count: 2 });

    await expect(service.rotateRefreshToken(RAW_TOKEN)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Refresh token inválido ou expirado',
    });
  });

  // ─── Detecção de reuse ───────────────────────────────────────────────────────

  it('token já revogado reapresentado: revoga TODOS os tokens do usuário (defesa contra roubo)', async () => {
    mockFindUnique.mockResolvedValueOnce(makeRecord({ revokedAt: new Date() }));
    mockUpdateMany.mockResolvedValueOnce({ count: 3 });

    await expect(service.rotateRefreshToken(RAW_TOKEN)).rejects.toMatchObject({ statusCode: 401 });

    // revokeAllUserTokens usa updateMany — garante que foi chamado para o userId correto
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-1', revokedAt: null }),
      }),
    );
  });
});

// ─── Garantia de armazenamento seguro ────────────────────────────────────────

describe('AuthService.issueRefreshToken — segurança de armazenamento', () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService();
    vi.clearAllMocks();
  });

  it('persiste tokenHash (SHA-256 do raw) e nunca persiste o token cru', async () => {
    mockCount.mockResolvedValueOnce(0);

    let capturedData: Record<string, unknown> | null = null;
    mockCreate.mockImplementationOnce(({ data }: { data: Record<string, unknown> }) => {
      capturedData = data;
      return Promise.resolve({ id: 'rt-new', ...data });
    });

    const rawToken = await service.issueRefreshToken('user-1');

    expect(capturedData).not.toBeNull();

    // O campo persistido deve ser tokenHash, nunca token
    expect(capturedData).toHaveProperty('tokenHash');
    expect(capturedData).not.toHaveProperty('token');

    // O valor de tokenHash deve ser exatamente o SHA-256 do raw retornado
    const expectedHash = sha256(rawToken);
    expect((capturedData as Record<string, unknown>).tokenHash).toBe(expectedHash);

    // O token cru não pode aparecer em nenhum valor persistido
    const persistedValues = Object.values(capturedData as Record<string, unknown>).map(String);
    expect(persistedValues).not.toContain(rawToken);
  });

  it('o raw token retornado ao cliente é diferente do hash persistido', async () => {
    mockCount.mockResolvedValueOnce(0);
    mockCreate.mockImplementationOnce(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'rt-new', ...data }),
    );

    const rawToken = await service.issueRefreshToken('user-1');
    const hash = sha256(rawToken);

    expect(rawToken).not.toBe(hash);
    expect(rawToken).toHaveLength(80); // 40 bytes hex = 80 chars
    expect(hash).toHaveLength(64);     // SHA-256 hex = 64 chars
  });
});
