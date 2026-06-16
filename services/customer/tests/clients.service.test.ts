import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClientsService } from '../src/modules/clients/clients.service';
import { NotFoundError, ConflictError, AppError } from '../src/lib/errors';

// Mock Prisma
vi.mock('../src/lib/prisma', () => ({
  prisma: {
    client: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

// Mock publisher
vi.mock('../src/lib/publisher', () => ({
  publish: vi.fn().mockResolvedValue(undefined),
}));

// Mock env
vi.mock('../src/env', () => ({
  env: {
    NODE_ENV: 'test',
    PORT: 3002,
    DATABASE_URL: 'postgresql://localhost/test',
    JWT_SECRET: 'test-secret-32-characters-minimum!',
    RABBITMQ_URL: 'amqp://localhost',
    RABBITMQ_EXCHANGE: 'controle-os',
    LOG_LEVEL: 'silent',
    APP_VERSION: '1.0.0',
  },
}));

import { prisma } from '../src/lib/prisma';
import { publish } from '../src/lib/publisher';

const mockUser = { id: 'user-1', companyId: 'company-1', role: 'ADMIN' };

const mockClient = {
  id: 'client-1',
  companyId: 'company-1',
  name: 'Joao Silva',
  email: 'joao@example.com',
  phone: '11999999999',
  document: '12345678901',
  type: 'INDIVIDUAL',
  isBlocked: false,
  blockedAt: null,
  blockedReason: null,
  address: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

describe('ClientsService', () => {
  let service: ClientsService;

  beforeEach(() => {
    service = new ClientsService();
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('returns paginated clients scoped by companyId', async () => {
      vi.mocked(prisma.client.findMany).mockResolvedValue([mockClient] as any);
      vi.mocked(prisma.client.count).mockResolvedValue(1);

      const result = await service.list({ page: 1, limit: 20 }, 'company-1');

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(prisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'company-1', deletedAt: null }),
        }),
      );
    });

    it('filters by name when provided', async () => {
      vi.mocked(prisma.client.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.client.count).mockResolvedValue(0);

      await service.list({ page: 1, limit: 20, name: 'Joao' }, 'company-1');

      expect(prisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ name: { contains: 'Joao', mode: 'insensitive' } }),
        }),
      );
    });

    it('filters by isBlocked when provided', async () => {
      vi.mocked(prisma.client.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.client.count).mockResolvedValue(0);

      await service.list({ page: 1, limit: 20, isBlocked: true }, 'company-1');

      expect(prisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isBlocked: true }),
        }),
      );
    });

    it('filters by document when provided', async () => {
      vi.mocked(prisma.client.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.client.count).mockResolvedValue(0);

      await service.list({ page: 1, limit: 20, document: '12345' }, 'company-1');

      expect(prisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ document: { contains: '12345' } }),
        }),
      );
    });
  });

  describe('findById', () => {
    it('returns client when found', async () => {
      vi.mocked(prisma.client.findFirst).mockResolvedValue(mockClient as any);

      const result = await service.findById('client-1', 'company-1');

      expect(result).toEqual(mockClient);
      expect(prisma.client.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'client-1', companyId: 'company-1', deletedAt: null },
        }),
      );
    });

    it('throws NotFoundError when client does not exist', async () => {
      vi.mocked(prisma.client.findFirst).mockResolvedValue(null);

      await expect(service.findById('nonexistent', 'company-1')).rejects.toThrow(NotFoundError);
    });
  });

  describe('create', () => {
    it('creates client and publishes client.created event', async () => {
      vi.mocked(prisma.client.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.client.create).mockResolvedValue(mockClient as any);

      const result = await service.create(
        { name: 'Joao Silva', document: '12345678901', type: 'INDIVIDUAL' },
        mockUser,
      );

      expect(result).toEqual(mockClient);
      expect(publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'client.created', companyId: 'company-1' }),
      );
    });

    it('throws ConflictError when document already exists', async () => {
      vi.mocked(prisma.client.findFirst).mockResolvedValue(mockClient as any);

      await expect(
        service.create({ name: 'Outro', document: '12345678901', type: 'INDIVIDUAL' }, mockUser),
      ).rejects.toThrow(ConflictError);

      expect(prisma.client.create).not.toHaveBeenCalled();
    });

    it('creates client without document check when document not provided', async () => {
      vi.mocked(prisma.client.create).mockResolvedValue(mockClient as any);

      await service.create({ name: 'Joao Silva', type: 'INDIVIDUAL' }, mockUser);

      expect(prisma.client.findFirst).not.toHaveBeenCalled();
      expect(prisma.client.create).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates client and publishes client.updated event', async () => {
      vi.mocked(prisma.client.findFirst).mockResolvedValue(mockClient as any);
      vi.mocked(prisma.client.update).mockResolvedValue({ ...mockClient, name: 'Novo Nome' } as any);

      const result = await service.update('client-1', { name: 'Novo Nome' }, mockUser);

      expect(result.name).toBe('Novo Nome');
      expect(publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'client.updated' }),
      );
    });

    it('throws NotFoundError when client not found', async () => {
      vi.mocked(prisma.client.findFirst).mockResolvedValue(null);

      await expect(service.update('nonexistent', { name: 'X' }, mockUser)).rejects.toThrow(
        NotFoundError,
      );
    });

    it('throws ConflictError when new document is already used by another client', async () => {
      vi.mocked(prisma.client.findFirst)
        .mockResolvedValueOnce(mockClient as any)
        .mockResolvedValueOnce({ id: 'other-client' } as any);

      await expect(
        service.update('client-1', { document: '99999999999' }, mockUser),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('softDelete', () => {
    it('sets deletedAt and publishes client.deleted event', async () => {
      vi.mocked(prisma.client.findFirst).mockResolvedValue(mockClient as any);
      vi.mocked(prisma.client.update).mockResolvedValue({ ...mockClient, deletedAt: new Date() } as any);

      const result = await service.softDelete('client-1', mockUser);

      expect(result).toEqual({ success: true });
      expect(publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'client.deleted' }),
      );
    });

    it('throws NotFoundError when client not found', async () => {
      vi.mocked(prisma.client.findFirst).mockResolvedValue(null);

      await expect(service.softDelete('nonexistent', mockUser)).rejects.toThrow(NotFoundError);
    });
  });

  describe('block', () => {
    it('blocks client and publishes client.blocked event', async () => {
      vi.mocked(prisma.client.findFirst).mockResolvedValue(mockClient as any);
      vi.mocked(prisma.client.update).mockResolvedValue({
        ...mockClient,
        isBlocked: true,
        blockedAt: new Date(),
        blockedReason: 'Inadimplente',
      } as any);

      const result = await service.block('client-1', { reason: 'Inadimplente' }, mockUser);

      expect(result.isBlocked).toBe(true);
      expect(publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'client.blocked' }),
      );
    });

    it('throws AppError when client is already blocked', async () => {
      vi.mocked(prisma.client.findFirst).mockResolvedValue({
        ...mockClient,
        isBlocked: true,
      } as any);

      await expect(
        service.block('client-1', { reason: 'x' }, mockUser),
      ).rejects.toThrow(AppError);
    });

    it('throws NotFoundError when client not found', async () => {
      vi.mocked(prisma.client.findFirst).mockResolvedValue(null);

      await expect(service.block('nonexistent', { reason: 'x' }, mockUser)).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe('unblock', () => {
    it('unblocks client and publishes client.unblocked event', async () => {
      vi.mocked(prisma.client.findFirst).mockResolvedValue({
        ...mockClient,
        isBlocked: true,
        blockedReason: 'Inadimplente',
      } as any);
      vi.mocked(prisma.client.update).mockResolvedValue({
        ...mockClient,
        isBlocked: false,
        blockedAt: null,
        blockedReason: null,
      } as any);

      const result = await service.unblock('client-1', mockUser);

      expect(result.isBlocked).toBe(false);
      expect(publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'client.unblocked' }),
      );
    });

    it('throws AppError when client is not blocked', async () => {
      vi.mocked(prisma.client.findFirst).mockResolvedValue(mockClient as any);

      await expect(service.unblock('client-1', mockUser)).rejects.toThrow(AppError);
    });

    it('throws NotFoundError when client not found', async () => {
      vi.mocked(prisma.client.findFirst).mockResolvedValue(null);

      await expect(service.unblock('nonexistent', mockUser)).rejects.toThrow(NotFoundError);
    });
  });
});
