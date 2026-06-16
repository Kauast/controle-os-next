import { describe, it, expect, vi, beforeEach } from 'vitest';

// Transação mockada: executa o callback com um tx falso controlável.
const mockTx = {
  serviceOrder: { findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  serviceOrderExecution: { findUnique: vi.fn(), upsert: vi.fn() },
  serviceOrderHistory: { create: vi.fn() },
  serviceOrderEvent: { create: vi.fn() },
  technician: { findFirst: vi.fn() },
};

vi.mock('../src/lib/prisma', () => ({
  prisma: { $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(mockTx)) },
}));
vi.mock('../src/modules/audit/audit.service', () => ({ audit: vi.fn() }));

import { ServiceOrderService } from '../src/modules/service-order/service-order.service';

const service = new ServiceOrderService();
const admin = { id: 'u1', role: 'ADMIN', companyId: 'c1' };

beforeEach(() => {
  vi.clearAllMocks();
  mockTx.serviceOrder.updateMany.mockResolvedValue({ count: 1 });
  mockTx.serviceOrderHistory.create.mockResolvedValue({});
  mockTx.serviceOrderEvent.create.mockResolvedValue({});
  mockTx.serviceOrderExecution.upsert.mockResolvedValue({});
});

describe('updateStatus — expectedVersion', () => {
  it('lança ConcurrencyError (409) quando expectedVersion é obsoleta', async () => {
    mockTx.serviceOrder.findFirst.mockResolvedValue({
      id: 'os1', companyId: 'c1', version: 2, status: 'OPEN', startDate: null, invoices: [],
    });
    await expect(
      service.updateStatus('os1', { status: 'IN_PROGRESS', expectedVersion: 1 } as never, admin),
    ).rejects.toMatchObject({ statusCode: 409, code: 'CONCURRENCY_CONFLICT' });
    expect(mockTx.serviceOrder.updateMany).not.toHaveBeenCalled();
  });

  it('passa pela porta de versão quando expectedVersion confere', async () => {
    mockTx.serviceOrder.findFirst.mockResolvedValue({
      id: 'os1', companyId: 'c1', version: 1, status: 'OPEN', startDate: null, invoices: [],
    });
    await service.updateStatus('os1', { status: 'IN_PROGRESS', expectedVersion: 1 } as never, admin);
    expect(mockTx.serviceOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'os1', companyId: 'c1', version: 1 } }),
    );
  });

  it('mantém compatibilidade: sem expectedVersion não bloqueia', async () => {
    mockTx.serviceOrder.findFirst.mockResolvedValue({
      id: 'os1', companyId: 'c1', version: 5, status: 'OPEN', startDate: null, invoices: [],
    });
    await service.updateStatus('os1', { status: 'IN_PROGRESS' } as never, admin);
    expect(mockTx.serviceOrder.updateMany).toHaveBeenCalled();
  });
});

describe('updateExecution — expectedVersion', () => {
  it('lança ConcurrencyError (409) quando expectedVersion é obsoleta', async () => {
    mockTx.serviceOrder.findFirst.mockResolvedValue({
      id: 'os1', companyId: 'c1', version: 3, status: 'IN_PROGRESS',
    });
    await expect(
      service.updateExecution('os1', { workDoneNotes: 'x', expectedVersion: 1 } as never, admin),
    ).rejects.toMatchObject({ statusCode: 409, code: 'CONCURRENCY_CONFLICT' });
    expect(mockTx.serviceOrderExecution.upsert).not.toHaveBeenCalled();
  });

  it('incrementa a versão (updateMany com guard) quando confere', async () => {
    mockTx.serviceOrder.findFirst.mockResolvedValue({
      id: 'os1', companyId: 'c1', version: 1, status: 'IN_PROGRESS',
    });
    await service.updateExecution('os1', { workDoneNotes: 'x', expectedVersion: 1 } as never, admin);
    expect(mockTx.serviceOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'os1', companyId: 'c1', version: 1 },
        data: expect.objectContaining({ version: { increment: 1 } }),
      }),
    );
  });
});
