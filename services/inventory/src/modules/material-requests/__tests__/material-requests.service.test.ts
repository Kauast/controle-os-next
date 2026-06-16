import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MaterialRequestsService } from '../material-requests.service';
import { NotFoundError, ConflictError } from '../../../lib/errors';

vi.mock('../../../lib/prisma', () => ({
  prisma: {
    product: { findFirst: vi.fn() },
    materialRequest: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../../../lib/publisher', () => ({
  publish: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from '../../../lib/prisma';
import { publish } from '../../../lib/publisher';

const service = new MaterialRequestsService();

describe('MaterialRequestsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('cria solicitacao de material com produto valido', async () => {
      vi.mocked(prisma.product.findFirst).mockResolvedValue({ id: 'prod-1', name: 'Cabo' } as never);
      vi.mocked(prisma.materialRequest.create).mockResolvedValue({ id: 'req-1', status: 'PENDING' } as never);

      const result = await service.create('company-1', {
        serviceOrderId: 'os-1',
        productId: 'prod-1',
        quantity: 2,
      });

      expect(result).toMatchObject({ id: 'req-1', status: 'PENDING' });
    });

    it('lanca NotFoundError para produto inexistente ou inativo', async () => {
      vi.mocked(prisma.product.findFirst).mockResolvedValue(null);

      await expect(
        service.create('company-1', { serviceOrderId: 'os-1', productId: 'prod-404', quantity: 1 }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('review', () => {
    it('aprova solicitacao pendente e publica evento', async () => {
      const request = {
        id: 'req-1', companyId: 'company-1', serviceOrderId: 'os-1',
        productId: 'prod-1', quantity: 3, status: 'PENDING',
      };

      vi.mocked(prisma.materialRequest.findFirst).mockResolvedValue(request as never);
      vi.mocked(prisma.materialRequest.update).mockResolvedValue({ ...request, status: 'APPROVED' } as never);

      await service.review('company-1', 'req-1', 'user-1', { status: 'APPROVED' });

      expect(prisma.materialRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'APPROVED' }) }),
      );
      expect(publish).toHaveBeenCalledWith('material_request.reviewed', expect.objectContaining({
        status: 'APPROVED',
        requestId: 'req-1',
      }));
    });

    it('lanca ConflictError ao tentar revisar solicitacao ja processada', async () => {
      vi.mocked(prisma.materialRequest.findFirst).mockResolvedValue({
        id: 'req-1', status: 'APPROVED',
      } as never);

      await expect(
        service.review('company-1', 'req-1', 'user-1', { status: 'REJECTED' }),
      ).rejects.toThrow(ConflictError);
    });

    it('lanca NotFoundError para solicitacao inexistente', async () => {
      vi.mocked(prisma.materialRequest.findFirst).mockResolvedValue(null);

      await expect(
        service.review('company-1', 'req-404', 'user-1', { status: 'APPROVED' }),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
