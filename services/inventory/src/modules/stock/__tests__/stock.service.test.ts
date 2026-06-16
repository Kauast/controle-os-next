import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StockService } from '../stock.service';
import { InsufficientStockError, NotFoundError } from '../../../lib/errors';

// Mock do prisma
vi.mock('../../../lib/prisma', () => ({
  prisma: {
    product: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    stockReservation: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      aggregate: vi.fn(),
    },
    stockMovement: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  },
}));

// Mock do publisher
vi.mock('../../../lib/publisher', () => ({
  publish: vi.fn().mockResolvedValue(undefined),
}));

// Mock de metricas
vi.mock('../../../lib/metrics', () => ({
  stockReservationTotal: { inc: vi.fn() },
}));

import { prisma } from '../../../lib/prisma';
import { publish } from '../../../lib/publisher';

const service = new StockService();

describe('StockService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getBalance', () => {
    it('retorna saldo com reservas ativas descontadas', async () => {
      vi.mocked(prisma.product.findFirst).mockResolvedValue({
        currentBalance: 100,
      } as never);

      vi.mocked(prisma.stockReservation.aggregate).mockResolvedValue({
        _sum: { quantity: 30 },
      } as never);

      const balance = await service.getBalance('company-1', 'product-1');

      expect(balance.physical).toBe(100);
      expect(balance.reserved).toBe(30);
      expect(balance.available).toBe(70);
    });

    it('lanca NotFoundError quando produto nao existe', async () => {
      vi.mocked(prisma.product.findFirst).mockResolvedValue(null);

      await expect(service.getBalance('company-1', 'product-404')).rejects.toThrow(NotFoundError);
    });

    it('retorna available = 0 quando reservas excedem saldo fisico', async () => {
      vi.mocked(prisma.product.findFirst).mockResolvedValue({
        currentBalance: 10,
      } as never);

      vi.mocked(prisma.stockReservation.aggregate).mockResolvedValue({
        _sum: { quantity: 15 },
      } as never);

      const balance = await service.getBalance('company-1', 'product-1');
      expect(balance.available).toBe(0);
    });
  });

  describe('createReservation', () => {
    it('cria reserva com sucesso e publica evento stock.reserved', async () => {
      const mockReservation = {
        id: 'res-1',
        companyId: 'company-1',
        productId: 'product-1',
        serviceOrderId: 'os-1',
        quantity: 5,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Simular transacao: executa o callback diretamente
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) => {
        const txMock = {
          $queryRaw: vi.fn().mockResolvedValue([{ id: 'product-1', currentBalance: 50 }]),
          stockReservation: {
            aggregate: vi.fn().mockResolvedValue({ _sum: { quantity: 10 } }),
            create: vi.fn().mockResolvedValue(mockReservation),
          },
        };
        return fn(txMock as never);
      });

      const result = await service.createReservation('company-1', 'user-1', {
        productId: 'product-1',
        serviceOrderId: 'os-1',
        quantity: 5,
      });

      expect(result.reservationId).toBe('res-1');
      expect(publish).toHaveBeenCalledWith('stock.reserved', expect.objectContaining({
        companyId: 'company-1',
        reservationId: 'res-1',
        serviceOrderId: 'os-1',
        quantity: 5,
      }));
    });

    it('lanca InsufficientStockError quando saldo disponivel e insuficiente', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) => {
        const txMock = {
          $queryRaw: vi.fn().mockResolvedValue([{ id: 'product-1', currentBalance: 10 }]),
          stockReservation: {
            aggregate: vi.fn().mockResolvedValue({ _sum: { quantity: 8 } }),
          },
        };
        return fn(txMock as never);
      });

      await expect(
        service.createReservation('company-1', 'user-1', {
          productId: 'product-1',
          serviceOrderId: 'os-1',
          quantity: 5, // disponivel = 10 - 8 = 2, solicitado = 5
        }),
      ).rejects.toThrow(InsufficientStockError);
    });

    it('lanca NotFoundError quando produto nao existe ou foi deletado', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) => {
        const txMock = {
          $queryRaw: vi.fn().mockResolvedValue([]), // nenhum produto encontrado
        };
        return fn(txMock as never);
      });

      await expect(
        service.createReservation('company-1', 'user-1', {
          productId: 'product-404',
          serviceOrderId: 'os-1',
          quantity: 1,
        }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('releaseReservation', () => {
    it('libera reserva ativa e publica evento stock.released', async () => {
      const reservation = {
        id: 'res-1',
        companyId: 'company-1',
        productId: 'product-1',
        serviceOrderId: 'os-1',
        quantity: 5,
        status: 'ACTIVE',
      };

      vi.mocked(prisma.stockReservation.findFirst).mockResolvedValue(reservation as never);
      vi.mocked(prisma.stockReservation.update).mockResolvedValue({ ...reservation, status: 'RELEASED' } as never);

      await service.releaseReservation('company-1', 'res-1', 'user-1');

      expect(prisma.stockReservation.update).toHaveBeenCalledWith({
        where: { id: 'res-1' },
        data: { status: 'RELEASED' },
      });

      expect(publish).toHaveBeenCalledWith('stock.released', expect.objectContaining({
        reservationId: 'res-1',
        serviceOrderId: 'os-1',
      }));
    });

    it('lanca NotFoundError se reserva nao existe ou ja nao esta ACTIVE', async () => {
      vi.mocked(prisma.stockReservation.findFirst).mockResolvedValue(null);

      await expect(service.releaseReservation('company-1', 'res-404', 'user-1')).rejects.toThrow(NotFoundError);
    });
  });

  describe('releaseAllReservationsByOrder', () => {
    it('libera todas as reservas ativas de uma OS', async () => {
      const reservations = [
        { id: 'res-1', productId: 'p1', serviceOrderId: 'os-1', quantity: 3, companyId: 'c1', status: 'ACTIVE' },
        { id: 'res-2', productId: 'p2', serviceOrderId: 'os-1', quantity: 7, companyId: 'c1', status: 'ACTIVE' },
      ];

      vi.mocked(prisma.stockReservation.findMany).mockResolvedValue(reservations as never);
      vi.mocked(prisma.stockReservation.update).mockResolvedValue({} as never);

      await service.releaseAllReservationsByOrder('c1', 'os-1');

      expect(prisma.stockReservation.update).toHaveBeenCalledTimes(2);
      expect(publish).toHaveBeenCalledTimes(2);
      expect(publish).toHaveBeenCalledWith('stock.released', expect.objectContaining({ reservationId: 'res-1' }));
      expect(publish).toHaveBeenCalledWith('stock.released', expect.objectContaining({ reservationId: 'res-2' }));
    });
  });

  describe('createMovement', () => {
    it('registra entrada e incrementa saldo', async () => {
      const movement = { id: 'mov-1', type: 'IN', quantity: 20, balanceBefore: 10, balanceAfter: 30 };

      vi.mocked(prisma.$transaction).mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) => {
        const txMock = {
          $queryRaw: vi.fn().mockResolvedValue([{ id: 'product-1', currentBalance: 10 }]),
          stockMovement: { create: vi.fn().mockResolvedValue(movement) },
          product: {
            update: vi.fn().mockResolvedValue({}),
            findUnique: vi.fn().mockResolvedValue({ minStock: 5, name: 'Produto A' }),
          },
        };
        return fn(txMock as never);
      });

      const result = await service.createMovement('company-1', 'user-1', 'User A', {
        productId: 'product-1',
        type: 'IN',
        quantity: 20,
      });

      expect(result).toMatchObject({ type: 'IN', quantity: 20, balanceAfter: 30 });
    });

    it('lanca InsufficientStockError em saida com saldo insuficiente', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) => {
        const txMock = {
          $queryRaw: vi.fn().mockResolvedValue([{ id: 'product-1', currentBalance: 5 }]),
        };
        return fn(txMock as never);
      });

      await expect(
        service.createMovement('company-1', 'user-1', 'User A', {
          productId: 'product-1',
          type: 'OUT',
          quantity: 10,
        }),
      ).rejects.toThrow(InsufficientStockError);
    });
  });
});
