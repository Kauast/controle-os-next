import { describe, it, expect, vi, beforeEach } from 'vitest';
import { compensateCreation, SagaState } from '../saga/compensation';

// Mock dos clientes HTTP
vi.mock('../../../lib/http-client', () => ({
  inventoryClient: {
    post: vi.fn().mockResolvedValue({ ok: true }),
  },
  chipClient: {
    delete: vi.fn().mockResolvedValue({ ok: true }),
  },
}));

vi.mock('../../../lib/publisher', () => ({
  publish: vi.fn().mockResolvedValue(true),
}));

describe('compensateCreation', () => {
  const mockPrisma = {
    serviceOrder: {
      update: vi.fn().mockResolvedValue({ id: 'os-1', status: 'CANCELLED' }),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('não executa compensação se já compensado', async () => {
    const sagaState: SagaState = {
      step: 3,
      reservationIds: ['res-1'],
      chipAssigned: false,
      compensated: true,
    };

    await compensateCreation(
      { serviceOrderId: 'os-1', companyId: 'co-1', sagaState },
      mockPrisma as unknown as Parameters<typeof compensateCreation>[1],
    );

    expect(mockPrisma.serviceOrder.update).not.toHaveBeenCalled();
  });

  it('cancela a OS via prisma', async () => {
    const sagaState: SagaState = {
      step: 2,
      reservationIds: [],
      chipAssigned: false,
      compensated: false,
    };

    await compensateCreation(
      { serviceOrderId: 'os-1', companyId: 'co-1', sagaState },
      mockPrisma as unknown as Parameters<typeof compensateCreation>[1],
    );

    expect(mockPrisma.serviceOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'os-1' },
        data: expect.objectContaining({ status: 'CANCELLED', cancelReason: 'SAGA_COMPENSATION' }),
      }),
    );
  });

  it('libera reservas de estoque existentes', async () => {
    const { inventoryClient } = await import('../../../lib/http-client');

    const sagaState: SagaState = {
      step: 4,
      reservationIds: ['res-aaa', 'res-bbb'],
      chipAssigned: false,
      compensated: false,
    };

    await compensateCreation(
      { serviceOrderId: 'os-1', companyId: 'co-1', sagaState },
      mockPrisma as unknown as Parameters<typeof compensateCreation>[1],
    );

    expect(inventoryClient.post).toHaveBeenCalledWith('/stock/reservations/res-aaa/release', {});
    expect(inventoryClient.post).toHaveBeenCalledWith('/stock/reservations/res-bbb/release', {});
  });

  it('desvinccula chip se chipAssigned=true', async () => {
    const { chipClient } = await import('../../../lib/http-client');

    const sagaState: SagaState = {
      step: 5,
      reservationIds: [],
      chipAssigned: true,
      compensated: false,
    };

    await compensateCreation(
      { serviceOrderId: 'os-1', companyId: 'co-1', chipId: 'chip-xyz', sagaState },
      mockPrisma as unknown as Parameters<typeof compensateCreation>[1],
    );

    expect(chipClient.delete).toHaveBeenCalledWith('/chips/chip-xyz/assign');
  });

  it('não chama chipClient.delete se chipAssigned=false', async () => {
    const { chipClient } = await import('../../../lib/http-client');

    const sagaState: SagaState = {
      step: 3,
      reservationIds: [],
      chipAssigned: false,
      compensated: false,
    };

    await compensateCreation(
      { serviceOrderId: 'os-1', companyId: 'co-1', chipId: 'chip-xyz', sagaState },
      mockPrisma as unknown as Parameters<typeof compensateCreation>[1],
    );

    expect(chipClient.delete).not.toHaveBeenCalled();
  });
});
