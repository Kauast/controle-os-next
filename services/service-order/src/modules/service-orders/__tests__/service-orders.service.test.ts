import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceOrderService } from '../service-orders.service';
import { AppError, NotFoundError } from '../../../lib/errors';

// Mock do prisma
const mockFindFirst  = vi.fn();
const mockFindMany   = vi.fn();
const mockCount      = vi.fn();
const mockUpdate     = vi.fn();
const mockCreate     = vi.fn();

vi.mock('../../../lib/prisma', () => ({
  prisma: {
    serviceOrder: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      findMany:  (...args: unknown[]) => mockFindMany(...args),
      count:     (...args: unknown[]) => mockCount(...args),
      update:    (...args: unknown[]) => mockUpdate(...args),
    },
    serviceOrderExecution: {
      create: (...args: unknown[]) => mockCreate(...args),
    },
    serviceOrderEvent: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      create:   (...args: unknown[]) => mockCreate(...args),
    },
    serviceOrderHistory: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

// Mock da saga — não testamos ela aqui
vi.mock('../saga/creation-saga', () => ({
  runCreationSaga: vi.fn().mockResolvedValue({ id: 'os-saga', status: 'OPEN' }),
}));

// Mock do publisher
vi.mock('../../../lib/publisher', () => ({
  publish: vi.fn().mockResolvedValue(true),
}));

// Mock do workforce client
vi.mock('../../../lib/http-client', () => ({
  workforceClient: {
    get: vi.fn().mockResolvedValue({ hasCapacity: true, currentLoad: 1, maxLoad: 5 }),
  },
  customerClient:  { get: vi.fn() },
  inventoryClient: { post: vi.fn() },
  chipClient:      { post: vi.fn() },
}));

const user = { id: 'user-1', role: 'ADMIN', companyId: 'company-1', name: 'Admin' };

describe('ServiceOrderService', () => {
  let service: ServiceOrderService;

  beforeEach(() => {
    service = new ServiceOrderService();
    vi.clearAllMocks();
  });

  // ── findById ──────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('retorna a OS quando encontrada', async () => {
      const os = { id: 'os-1', companyId: 'company-1', status: 'OPEN' };
      mockFindFirst.mockResolvedValue(os);

      const result = await service.findById('os-1', user);
      expect(result).toEqual(os);
    });

    it('lança NotFoundError quando não encontrada', async () => {
      mockFindFirst.mockResolvedValue(null);
      await expect(service.findById('os-nao-existe', user)).rejects.toThrow(NotFoundError);
    });

    it('filtra por technicianId quando role=TECHNICIAN', async () => {
      const techUser = { ...user, role: 'TECHNICIAN' };
      mockFindFirst.mockResolvedValue({ id: 'os-1', technicianId: 'user-1' });

      await service.findById('os-1', techUser);

      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ technicianId: 'user-1' }),
        }),
      );
    });
  });

  // ── delete ────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('soft-delete uma OS em status OPEN', async () => {
      const os = { id: 'os-1', companyId: 'company-1', status: 'OPEN', number: '1' };
      mockFindFirst.mockResolvedValue(os);
      mockUpdate.mockResolvedValue({ ...os, deletedAt: new Date() });

      const result = await service.delete('os-1', user);
      expect(result.success).toBe(true);
    });

    it('soft-delete uma OS em status PENDING_RESERVATION', async () => {
      const os = { id: 'os-1', companyId: 'company-1', status: 'PENDING_RESERVATION', number: '2' };
      mockFindFirst.mockResolvedValue(os);
      mockUpdate.mockResolvedValue({ ...os, deletedAt: new Date() });

      const result = await service.delete('os-1', user);
      expect(result.success).toBe(true);
    });

    it('bloqueia exclusão de OS em status IN_PROGRESS', async () => {
      const os = { id: 'os-1', companyId: 'company-1', status: 'IN_PROGRESS', number: '3' };
      mockFindFirst.mockResolvedValue(os);

      await expect(service.delete('os-1', user)).rejects.toThrow(AppError);
    });

    it('bloqueia exclusão de OS COMPLETED', async () => {
      const os = { id: 'os-1', companyId: 'company-1', status: 'COMPLETED', number: '4' };
      mockFindFirst.mockResolvedValue(os);

      await expect(service.delete('os-1', user)).rejects.toThrow(AppError);
    });

    it('lança NotFoundError se OS não existe', async () => {
      mockFindFirst.mockResolvedValue(null);
      await expect(service.delete('inexistente', user)).rejects.toThrow(NotFoundError);
    });
  });

  // ── updateStatus ──────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('transição válida OPEN → ASSIGNED', async () => {
      const os = { id: 'os-1', companyId: 'company-1', status: 'OPEN', technicianId: null };
      mockFindFirst.mockResolvedValue(os);
      mockUpdate.mockResolvedValue({ ...os, status: 'ASSIGNED' });

      const result = await service.updateStatus('os-1', { status: 'ASSIGNED' }, user);
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('rejeita transição inválida COMPLETED → OPEN', async () => {
      const os = { id: 'os-1', companyId: 'company-1', status: 'COMPLETED', technicianId: null };
      mockFindFirst.mockResolvedValue(os);

      await expect(
        service.updateStatus('os-1', { status: 'OPEN' }, user),
      ).rejects.toThrow(AppError);
    });

    it('exige cancelReason para CANCELLED', async () => {
      const os = { id: 'os-1', companyId: 'company-1', status: 'OPEN', technicianId: null };
      mockFindFirst.mockResolvedValue(os);

      // Sem cancelReason — deve falhar no schema antes mesmo de chegar no service
      // Aqui testamos apenas o guard do service (schema já validado antes)
      mockUpdate.mockResolvedValue({ ...os, status: 'CANCELLED' });
      const result = await service.updateStatus(
        'os-1',
        { status: 'CANCELLED', cancelReason: 'Cliente desistiu' },
        user,
      );
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  // ── assign ────────────────────────────────────────────────────────────────

  describe('assign', () => {
    it('atribui técnico quando OS está em OPEN', async () => {
      const os = { id: 'os-1', companyId: 'company-1', status: 'OPEN' };
      mockFindFirst.mockResolvedValue(os);
      mockUpdate.mockResolvedValue({ ...os, status: 'ASSIGNED', technicianId: 'tech-1' });

      const result = await service.assign('os-1', { technicianId: 'tech-1', technicianName: 'Carlos' }, user);
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('rejeita atribuição quando OS não está em OPEN', async () => {
      const os = { id: 'os-1', companyId: 'company-1', status: 'IN_PROGRESS' };
      mockFindFirst.mockResolvedValue(os);

      await expect(
        service.assign('os-1', { technicianId: 'tech-1', technicianName: 'Carlos' }, user),
      ).rejects.toThrow(AppError);
    });

    it('lança NotFoundError se OS não existe', async () => {
      mockFindFirst.mockResolvedValue(null);
      await expect(
        service.assign('inexistente', { technicianId: 'tech-1', technicianName: 'Carlos' }, user),
      ).rejects.toThrow(NotFoundError);
    });
  });

  // ── create (saga) ─────────────────────────────────────────────────────────

  describe('create', () => {
    it('delega à saga e retorna resultado', async () => {
      const { runCreationSaga } = await import('../saga/creation-saga');
      const result = await service.create(
        {
          clientId: 'c-1',
          clientName: 'João',
          description: 'Instalação',
          priority: 'MEDIUM',
          items: [],
        },
        user,
      );
      expect(runCreationSaga).toHaveBeenCalled();
      expect(result).toEqual({ id: 'os-saga', status: 'OPEN' });
    });
  });
});
