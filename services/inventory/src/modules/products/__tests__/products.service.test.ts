import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductsService } from '../products.service';
import { NotFoundError, ConflictError } from '../../../lib/errors';

vi.mock('../../../lib/prisma', () => ({
  prisma: {
    product: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      fields: { minStock: 'minStock' },
    },
    productCategory: {
      findFirst: vi.fn(),
    },
    stockReservation: {
      count: vi.fn(),
    },
  },
}));

import { prisma } from '../../../lib/prisma';

const service = new ProductsService();

describe('ProductsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('cria produto com categoria valida', async () => {
      vi.mocked(prisma.productCategory.findFirst).mockResolvedValue({ id: 'cat-1', name: 'Eletronicos' } as never);
      vi.mocked(prisma.product.create).mockResolvedValue({ id: 'prod-1', name: 'Resistor' } as never);

      const result = await service.create({
        companyId: 'company-1',
        categoryId: 'cat-1',
        name: 'Resistor',
        unit: 'un',
        minStock: 10,
        isActive: true,
      });

      expect(result).toMatchObject({ id: 'prod-1' });
    });

    it('lanca NotFoundError quando categoria nao existe', async () => {
      vi.mocked(prisma.productCategory.findFirst).mockResolvedValue(null);

      await expect(
        service.create({
          companyId: 'company-1',
          categoryId: 'cat-404',
          name: 'Produto',
          unit: 'un',
          minStock: 0,
          isActive: true,
        }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('softDelete', () => {
    it('deleta produto sem reservas ativas', async () => {
      vi.mocked(prisma.product.findFirst).mockResolvedValue({ id: 'prod-1' } as never);
      vi.mocked(prisma.stockReservation.count).mockResolvedValue(0);
      vi.mocked(prisma.product.update).mockResolvedValue({} as never);

      await service.softDelete('company-1', 'prod-1');

      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isActive: false }) }),
      );
    });

    it('lanca ConflictError quando produto tem reservas ativas', async () => {
      vi.mocked(prisma.product.findFirst).mockResolvedValue({ id: 'prod-1' } as never);
      vi.mocked(prisma.stockReservation.count).mockResolvedValue(2);

      await expect(service.softDelete('company-1', 'prod-1')).rejects.toThrow(ConflictError);
    });

    it('lanca NotFoundError quando produto nao existe', async () => {
      vi.mocked(prisma.product.findFirst).mockResolvedValue(null);

      await expect(service.softDelete('company-1', 'prod-404')).rejects.toThrow(NotFoundError);
    });
  });

  describe('findById', () => {
    it('retorna produto com categoria e reservas', async () => {
      const product = {
        id: 'prod-1',
        name: 'Produto A',
        category: { id: 'cat-1', name: 'Eletronicos' },
        reservations: [],
      };
      vi.mocked(prisma.product.findFirst).mockResolvedValue(product as never);

      const result = await service.findById('company-1', 'prod-1');
      expect(result.id).toBe('prod-1');
    });

    it('lanca NotFoundError quando produto nao existe', async () => {
      vi.mocked(prisma.product.findFirst).mockResolvedValue(null);

      await expect(service.findById('company-1', 'prod-404')).rejects.toThrow(NotFoundError);
    });
  });
});
