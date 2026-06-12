import { z } from 'zod';
import { AuditAction, MovementType } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { RequestContext } from '../shared/context/requestContext';
import { StockService } from '../modules/stock/application/stockService';
import { audit } from '../lib/audit';

export const createProductSchema = z.object({
  name: z.string().min(2),
  sku: z.string().min(3),
  description: z.string().optional(),
  category: z.string().optional().default(''),
  categoryId: z.string().optional(),
  location: z.string().optional().default(''),
  stockQuantity: z.number().int().min(0).default(0),
  minStock: z.number().int().min(0).default(0),
  cost: z.number().min(0).default(0),
  price: z.number().min(0).default(0),
});

export const adjustStockSchema = z.object({
  quantity: z.number().int(),
  reason: z.string().min(3),
  type: z.nativeEnum(MovementType).optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

const stockService = new StockService();

export class ProductService {
  async create(data: CreateProductInput) {
    const tenantId = RequestContext.get().tenantId;
    if (!tenantId) throw new AppError('Tenant não resolvido', 400);

    const existing = await prisma.product.findFirst({
      where: { tenantId, sku: data.sku, deletedAt: null },
    });
    if (existing) throw new AppError('SKU já cadastrado', 409);

    return prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          tenantId,
          name: data.name,
          sku: data.sku,
          description: data.description,
          category: data.category,
          categoryId: data.categoryId,
          location: data.location,
          minStock: data.minStock,
          cost: data.cost,
          price: data.price,
        },
      });

      if (data.stockQuantity > 0) {
        await stockService.createMovement({
          product,
          quantity: data.stockQuantity,
          reason: 'Saldo inicial',
          type: MovementType.IN,
          tx,
        });
      }

      await audit({
        tenantId,
        entity: 'Product',
        entityId: product.id,
        action: AuditAction.INSERT,
        after: { sku: product.sku, name: product.name },
      });

      return tx.product.findFirst({ where: { id: product.id } });
    });
  }

  async list(filters: { page?: number; limit?: number; search?: string }) {
    const tenantId = RequestContext.get().tenantId;
    if (!tenantId) throw new AppError('Tenant não resolvido', 400);

    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 100, 200);
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      deletedAt: null,
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: 'insensitive' as const } },
              { sku: { contains: filters.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
      prisma.product.count({ where }),
    ]);

    const enriched = await Promise.all(products.map(async (product) => ({
      ...product,
      ...(await stockService.getProductBalance(product.id)),
    })));

    return { products: enriched, total, page, totalPages: Math.ceil(total / limit) };
  }

  async adjustStock(id: string, quantity: number, reason?: string, userId?: string) {
    const tenantId = RequestContext.get().tenantId;
    if (!tenantId) throw new AppError('Tenant não resolvido', 400);

    const product = await prisma.product.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!product) throw new AppError('Produto não encontrado', 404);

    const result = await stockService.createMovement({
      product,
      quantity,
      reason: reason ?? (quantity >= 0 ? 'Entrada de estoque' : 'Saída de estoque'),
      userId,
    });

    await audit({
      tenantId,
      entity: 'Product',
      entityId: product.id,
      action: AuditAction.UPDATE,
      before: { version: product.version, stockQuantity: product.stockQuantity },
      after: result,
      detail: reason,
    });

    return {
      ...(await prisma.product.findFirst({ where: { id: product.id } })),
      ...result,
    };
  }

  async lowStock() {
    const tenantId = RequestContext.get().tenantId;
    if (!tenantId) throw new AppError('Tenant não resolvido', 400);

    const products = await prisma.product.findMany({
      where: { tenantId, deletedAt: null, minStock: { gt: 0 } },
      orderBy: { name: 'asc' },
    });

    const lowStock = [];
    for (const product of products) {
      const balance = await stockService.getProductBalance(product.id);
      if (balance.available <= product.minStock) {
        lowStock.push({ ...product, ...balance });
      }
    }

    return lowStock.sort((a, b) => a.available - b.available);
  }
}

