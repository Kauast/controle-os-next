import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

export const createProductSchema = z.object({
  name: z.string().min(2),
  sku: z.string().min(3),
  description: z.string().optional(),
  stockQuantity: z.number().int().min(0).default(0),
  price: z.number().positive(),
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
    const limit = Math.min(filters.limit ?? 10, 100);
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

  async lowStock(threshold = 5) {
    return prisma.product.findMany({
      where: { stockQuantity: { lte: threshold } },
      orderBy: { stockQuantity: 'asc' },
    });
  }
}
