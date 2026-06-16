import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConcurrencyError } from '../src/shared/errors';

const { updateStatus, updateExecution } = vi.hoisted(() => ({
  updateStatus: vi.fn(),
  updateExecution: vi.fn(),
}));

vi.mock('../src/modules/service-order/service-order.service', () => ({
  ServiceOrderService: vi.fn(function () {
    return { updateStatus, updateExecution };
  }),
}));

import { SyncService } from '../src/modules/sync/sync.service';

const service = new SyncService();
const user = { id: 'u1', role: 'TECHNICIAN', companyId: 'c1' };

beforeEach(() => vi.clearAllMocks());

describe('SyncService.processBatch', () => {
  it('agrega ok e conflict por item sem derrubar o lote', async () => {
    updateStatus.mockResolvedValueOnce({ id: 'os1', version: 2 });
    updateStatus.mockRejectedValueOnce(new ConcurrencyError());

    const results = await service.processBatch(
      [
        { clientActionId: 'a1', type: 'UPDATE_STATUS', serviceOrderId: 'os1', payload: { status: 'IN_PROGRESS' }, expectedVersion: 1 },
        { clientActionId: 'a2', type: 'UPDATE_STATUS', serviceOrderId: 'os1', payload: { status: 'WAITING_PARTS' }, expectedVersion: 1 },
      ],
      user,
    );

    expect(results[0]).toMatchObject({ clientActionId: 'a1', status: 'ok' });
    expect(results[1]).toMatchObject({ clientActionId: 'a2', status: 'conflict', code: 'CONCURRENCY_CONFLICT' });
  });

  it('erros genéricos viram status error', async () => {
    updateExecution.mockRejectedValueOnce(new Error('boom'));
    const results = await service.processBatch(
      [{ clientActionId: 'b1', type: 'UPDATE_EXECUTION', serviceOrderId: 'os1', payload: { workDoneNotes: 'x' } }],
      user,
    );
    expect(results[0]).toMatchObject({ clientActionId: 'b1', status: 'error', error: 'boom' });
  });

  it('repassa expectedVersion no input do service', async () => {
    updateStatus.mockResolvedValueOnce({ ok: true });
    await service.processBatch(
      [{ clientActionId: 'c1', type: 'UPDATE_STATUS', serviceOrderId: 'os9', payload: { status: 'IN_PROGRESS' }, expectedVersion: 7 }],
      user,
    );
    expect(updateStatus).toHaveBeenCalledWith('os9', expect.objectContaining({ status: 'IN_PROGRESS', expectedVersion: 7 }), user);
  });
});
