import { prisma } from '../../lib/prisma';
import { NotFoundError, ConflictError } from '../../lib/errors';
import { parsePagination, buildPaginatedResult } from '../../lib/pagination';
import type { CreateProductInput, UpdateProductInput, ListProductsQuery } from './products.schema';

export class ProductsService {
  async list(companyId: string, query: ListProductsQuery) {
    const { page, limit, skip } = parsePagination(query);

    const where: Record<string, unknown> = {
      companyId,
      deletedAt: null,
    };

    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    if (query.belowMinStock) {
      // Filtra produtos cujo saldo atual esta abaixo do minimo
      // currentBalance < minStock E minStock > 0
      (where as Record<string, unknown>).AND = [
        { minStock: { gt: 0 } },
        { currentBalance: { lt: prisma.product.fields.minStock } },
      ];
      // Prisma nao suporta comparacao entre colunas diretamente — usamos queryRaw para esse filtro
    }

    if (query.belowMinStock) {
      // Abordagem alternativa: buscar tudo e filtrar em memoria para consistencia
      // Em volumes altos, criar view ou indice funcional no Postgres
      const all = await prisma.product.findMany({
        where: { companyId, deletedAt: null, ...(query.categoryId ? { categoryId: query.categoryId } : {}), ...(query.isActive !== undefined ? { isActive: query.isActive } : {}) },
        include: { category: { select: { id: true, name: true } } },
        orderBy: { name: 'asc' },
      });

      const filtered = all.filter((p) => p.minStock > 0 && p.currentBalance < p.minStock);
      const sliced = filtered.slice(skip, skip + limit);

      return buildPaginatedResult(sliced, filtered.length, page, limit);
    }

    const [data, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: { category: { select: { id: true, name: true } } },
      }),
      prisma.product.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findById(companyId: string, id: string) {
    const product = await prisma.product.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        category: { select: { id: true, name: true } },
        reservations: {
          where: { status: 'ACTIVE' },
          select: { id: true, serviceOrderId: true, quantity: true, createdAt: true },
        },
      },
    });

    if (!product) throw new NotFoundError('Produto');
    return product;
  }

  async create(input: CreateProductInput) {
    if (input.categoryId) {
      const category = await prisma.productCategory.findFirst({
        where: { id: input.categoryId, companyId: input.companyId },
      });
      if (!category) throw new NotFoundError('Categoria');
    }

    return prisma.product.create({
      data: {
        companyId: input.companyId,
        categoryId: input.categoryId,
        name: input.name,
        unit: input.unit,
        minStock: input.minStock,
        price: input.price,
        isActive: input.isActive,
        currentBalance: 0,
      },
      include: { category: { select: { id: true, name: true } } },
    });
  }

  async update(companyId: string, id: string, input: UpdateProductInput) {
    const product = await prisma.product.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!product) throw new NotFoundError('Produto');

    if (input.categoryId) {
      const category = await prisma.productCategory.findFirst({
        where: { id: input.categoryId, companyId },
      });
      if (!category) throw new NotFoundError('Categoria');
    }

    return prisma.product.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.unit !== undefined && { unit: input.unit }),
        ...(input.minStock !== undefined && { minStock: input.minStock }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(Object.prototype.hasOwnProperty.call(input, 'categoryId') && { categoryId: input.categoryId }),
        ...(Object.prototype.hasOwnProperty.call(input, 'price') && { price: input.price }),
      },
      include: { category: { select: { id: true, name: true } } },
    });
  }

  async softDelete(companyId: string, id: string) {
    const product = await prisma.product.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!product) throw new NotFoundError('Produto');

    const activeReservations = await prisma.stockReservation.count({
      where: { productId: id, status: 'ACTIVE' },
    });
    if (activeReservations > 0) {
      throw new ConflictError('Produto possui reservas ativas e nao pode ser removido');
    }

    await prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }
}
