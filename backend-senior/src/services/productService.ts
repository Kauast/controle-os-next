import { z } from 'zod';
import { prisma } from '../lib/prisma';

export const createProductSchema = z.object({
  name: z.string().min(2),
  sku: z.string().min(3),
  description: z.string().optional(),
  category: z.string().optional().default(''),
  location: z.string().optional().default(''),
  stockQuantity: z.number().int().min(0).default(0),
  minStock: z.number().int().min(0).default(0),
  cost: z.number().min(0).default(0),
  price: z.number().min(0).default(0),
});

export const adjustStockSchema = z.object({
  quantity: z.number().int(),
  reason: z.string().min(3),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

export class ProductService {
  async create(data: CreateProductInput) {
    const existing = await prisma.product.findUnique({ where: { sku: data.sku } });
    if (existing) throw new Error('SKU já cadastrado');
    return prisma.product.create({ data });
  }

  async list(filters: { page?: number; limit?: number; search?: string }) {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 100, 200);
    const skip = (page - 1) * limit;

    const where = filters.search
      ? {
          OR: [
            { name: { contains: filters.search, mode: 'insensitive' as const } },
            { sku: { contains: filters.search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [products, total] = await Promise.all([
      prisma.product.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
      prisma.product.count({ where }),
    ]);

    return { products, total, page, totalPages: Math.ceil(total / limit) };
  }

  async adjustStock(id: string, quantity: number) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new Error('Produto não encontrado');

    const newQty = product.stockQuantity + quantity;
    if (newQty < 0) throw new Error('Estoque não pode ser negativo');

    return prisma.product.update({
      where: { id },
      data: { stockQuantity: newQty },
    });
  }

  async lowStock() {
    const products = await prisma.product.findMany({
      where: { minStock: { gt: 0 } },
      orderBy: { stockQuantity: 'asc' },
    });
    return products.filter((p) => p.stockQuantity <= p.minStock);
  }
}
