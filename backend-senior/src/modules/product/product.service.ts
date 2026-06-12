import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { audit } from '../audit/audit.service';
import { StockService } from '../stock/stock.service';
import { NotFoundError, ConflictError, ConcurrencyError, ValidationError } from '../../shared/errors';
import { parsePagination, buildPaginatedResult } from '../../shared/pagination';

export const createProductSchema = z.object({
  name: z.string().min(2).max(200),
  sku: z.string().min(2).max(50),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  location: z.string().optional().default(''),
  minStock: z.number().int().min(0).default(0),
  cost: z.number().nonnegative().default(0),
  price: z.number().nonnegative(),
  initialStock: z.number().int().min(0).optional(),
});

export const updateProductSchema = createProductSchema.partial().omit({ sku: true, initialStock: true });

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

interface RequestUser {
  id: string;
  companyId: string;
}

const stockService = new StockService();

export class ProductService {
  async create(data: CreateProductInput, user: RequestUser) {
    const existing = await prisma.product.findFirst({ where: { companyId: user.companyId, sku: data.sku } });
    if (existing) throw new ConflictError('SKU já cadastrado');

    if (data.categoryId) {
      const cat = await prisma.productCategory.findFirst({ where: { id: data.categoryId, companyId: user.companyId } });
      if (!cat) throw new NotFoundError('Categoria');
    }

    const product = await prisma.product.create({
      data: {
        companyId: user.companyId,
        categoryId: data.categoryId,
        name: data.name,
        sku: data.sku,
        description: data.description,
        location: data.location,
        minStock: data.minStock,
        cost: new Prisma.Decimal(data.cost),
        price: new Prisma.Decimal(data.price),
      },
      include: { category: true },
    });

    if (data.initialStock && data.initialStock > 0) {
      await stockService.adjustStock({
        companyId: user.companyId,
        productId: product.id,
        type: 'IN',
        quantity: data.initialStock,
        reason: 'Estoque inicial',
        userId: user.id,
        unitCost: data.cost,
      });
    }

    await audit({ companyId: user.companyId, userId: user.id, entity: 'Product', entityId: product.id, action: 'PRODUCT_CREATED', after: { name: product.name, sku: product.sku } });
    return product;
  }

  async update(id: string, data: UpdateProductInput, user: RequestUser) {
    return prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({ where: { id, companyId: user.companyId } });
      if (!product) throw new NotFoundError('Produto');

      if (data.categoryId) {
        const cat = await tx.productCategory.findFirst({ where: { id: data.categoryId, companyId: user.companyId } });
        if (!cat) throw new NotFoundError('Categoria');
      }

      const before = { name: product.name, price: product.price, version: product.version };

      const result = await tx.product.updateMany({
        where: { id, companyId: user.companyId, version: product.version },
        data: {
          ...data,
          cost: data.cost !== undefined ? new Prisma.Decimal(data.cost) : undefined,
          price: data.price !== undefined ? new Prisma.Decimal(data.price) : undefined,
          version: { increment: 1 },
        },
      });
      if (result.count === 0) throw new ConcurrencyError();

      await audit({ companyId: user.companyId, userId: user.id, entity: 'Product', entityId: id, action: 'PRODUCT_UPDATED', before, after: data });
      return tx.product.findFirst({ where: { id }, include: { category: true } });
    });
  }

  async list(params: {
    companyId: string;
    search?: string;
    categoryId?: string;
    lowStock?: boolean;
    page?: number;
    limit?: number;
  }) {
    const { page, limit, skip } = parsePagination(params, 200);
    const where: Prisma.ProductWhereInput = { companyId: params.companyId };
    if (params.categoryId) where.categoryId = params.categoryId;
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { sku: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({ where, skip, take: limit, include: { category: true }, orderBy: { name: 'asc' } }),
      prisma.product.count({ where }),
    ]);

    // Adiciona saldo de estoque em cada produto
    const data = await Promise.all(
      products.map(async (p) => {
        const balance = await stockService.getBalance(p.id);
        return { ...p, stockBalance: balance };
      }),
    );

    const filtered = params.lowStock ? data.filter((p) => p.stockBalance.available <= p.minStock) : data;

    return buildPaginatedResult(filtered, params.lowStock ? filtered.length : total, page, limit);
  }

  async findById(id: string, companyId: string) {
    const product = await prisma.product.findFirst({
      where: { id, companyId },
      include: {
        category: true,
        stockMovements: { orderBy: { createdAt: 'desc' }, take: 20 },
        stockReservations: { where: { status: 'ACTIVE' } },
      },
    });
    if (!product) throw new NotFoundError('Produto');

    const balance = await stockService.getBalance(id);
    return { ...product, stockBalance: balance };
  }

  async delete(id: string, user: RequestUser) {
    const product = await prisma.product.findFirst({ where: { id, companyId: user.companyId } });
    if (!product) throw new NotFoundError('Produto');

    const balance = await stockService.getBalance(id);
    if (balance.physical > 0) {
      throw new ValidationError(`Produto possui ${balance.physical} unidades em estoque. Zere o estoque antes de excluir.`);
    }

    await prisma.product.update({ where: { id }, data: { deletedAt: new Date(), deletedBy: user.id } });
    await audit({ companyId: user.companyId, userId: user.id, entity: 'Product', entityId: id, action: 'PRODUCT_DELETED' });
    return { success: true };
  }

  async createCategory(data: { name: string }, user: RequestUser) {
    const existing = await prisma.productCategory.findFirst({ where: { companyId: user.companyId, name: data.name } });
    if (existing) throw new ConflictError('Categoria já existe');

    return prisma.productCategory.create({ data: { companyId: user.companyId, name: data.name } });
  }

  async listCategories(companyId: string) {
    return prisma.productCategory.findMany({ where: { companyId, deletedAt: null }, orderBy: { name: 'asc' } });
  }
}
