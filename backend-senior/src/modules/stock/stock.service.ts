import { Prisma } from '@prisma/client';
import { prisma, TxClient } from '../../lib/prisma';
import { AppError, NotFoundError, InsufficientStockError, ConcurrencyError } from '../../shared/errors';
import { audit } from '../audit/audit.service';
import { parsePagination, buildPaginatedResult } from '../../shared/pagination';

export type MovementType = 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT' | 'LOSS' | 'RETURN';

export interface StockBalance {
  productId: string;
  physical: number;
  reserved: number;
  available: number;
}

export interface AdjustStockParams {
  companyId: string;
  productId: string;
  type: MovementType;
  quantity: number;
  reason?: string;
  serviceOrderId?: string;
  userId?: string;
  unitCost?: number;
}

export class StockService {
  // Calcula saldo a partir dos movimentos. Usa o último balanceAfter para eficiência.
  async getBalance(productId: string, tx?: TxClient): Promise<StockBalance> {
    const db = tx ?? prisma;

    const lastMovement = await db.stockMovement.findFirst({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      select: { balanceAfter: true },
    });

    const physical = lastMovement?.balanceAfter ?? 0;

    const reservedAgg = await db.stockReservation.aggregate({
      where: { productId, status: 'ACTIVE' },
      _sum: { quantity: true },
    });
    const reserved = reservedAgg._sum.quantity ?? 0;

    return { productId, physical, reserved, available: Math.max(0, physical - reserved) };
  }

  // Movimentação com lock pessimista no produto — evita race conditions de estoque negativo.
  async adjustStock(params: AdjustStockParams): Promise<{ movement: unknown; balance: StockBalance }> {
    const {
      companyId, productId, type, quantity, reason,
      serviceOrderId, userId, unitCost,
    } = params;

    if (quantity <= 0) throw new AppError('Quantidade deve ser positiva');

    return prisma.$transaction(async (tx) => {
      // SELECT FOR UPDATE no produto — garante serialização por produto
      const rows = await tx.$queryRaw<Array<{ id: string; version: number }>>`
        SELECT id, version FROM "Product"
        WHERE id = ${productId} AND "deletedAt" IS NULL
        FOR UPDATE
      `;
      if (!rows.length) throw new NotFoundError('Produto');

      const product = rows[0];

      const balance = await this.getBalance(productId, tx);
      const isDecrease = ['OUT', 'TRANSFER', 'LOSS'].includes(type);

      if (isDecrease && balance.physical < quantity) {
        throw new InsufficientStockError(productId, balance.physical, quantity);
      }

      const balanceBefore = balance.physical;
      const balanceAfter = isDecrease ? balanceBefore - quantity : balanceBefore + quantity;

      const movement = await tx.stockMovement.create({
        data: {
          companyId,
          productId,
          type,
          quantity,
          balanceBefore,
          balanceAfter,
          unitCost: unitCost !== undefined ? new Prisma.Decimal(unitCost) : undefined,
          reason: reason ?? type,
          serviceOrderId,
          userId,
        },
      });

      // Incrementar version do produto para invalidar caches
      await tx.$executeRaw`
        UPDATE "Product" SET "version" = "version" + 1, "updatedAt" = NOW()
        WHERE id = ${productId} AND "version" = ${product.version}
      `;

      await audit({
        companyId,
        userId,
        entity: 'Product',
        entityId: productId,
        action: `STOCK_${type}`,
        after: { balanceBefore, balanceAfter, quantity, type },
      });

      return { movement, balance: { productId, physical: balanceAfter, reserved: balance.reserved, available: Math.max(0, balanceAfter - balance.reserved) } };
    });
  }

  // Reserva estoque para uma OS (saldo disponível diminui, mas físico fica igual)
  async reserve(params: {
    companyId: string;
    productId: string;
    serviceOrderId: string;
    quantity: number;
    userId?: string;
  }): Promise<void> {
    const { companyId, productId, serviceOrderId, quantity, userId } = params;

    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${productId} FOR UPDATE`;

      const balance = await this.getBalance(productId, tx);
      if (balance.available < quantity) {
        throw new InsufficientStockError(productId, balance.available, quantity);
      }

      await tx.stockReservation.create({
        data: { companyId, productId, serviceOrderId, quantity, status: 'ACTIVE' },
      });

      await audit({ companyId, userId, entity: 'Product', entityId: productId, action: 'STOCK_RESERVED', after: { quantity, serviceOrderId } });
    });
  }

  // Consome a reserva (transforma em saída real) quando a OS é concluída
  async consumeReservation(serviceOrderId: string, userId?: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const reservations = await tx.stockReservation.findMany({
        where: { serviceOrderId, status: 'ACTIVE' },
      });

      for (const res of reservations) {
        await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${res.productId} FOR UPDATE`;
        const balance = await this.getBalance(res.productId, tx);

        if (balance.physical < res.quantity) {
          throw new InsufficientStockError(res.productId, balance.physical, res.quantity);
        }

        await tx.stockMovement.create({
          data: {
            companyId: res.companyId,
            productId: res.productId,
            type: 'OUT',
            quantity: res.quantity,
            balanceBefore: balance.physical,
            balanceAfter: balance.physical - res.quantity,
            reason: `Consumo OS ${serviceOrderId}`,
            serviceOrderId,
            userId,
          },
        });

        await tx.stockReservation.update({
          where: { id: res.id },
          data: { status: 'CONSUMED', releasedAt: new Date() },
        });

        await tx.$executeRaw`
          UPDATE "Product" SET "version" = "version" + 1, "updatedAt" = NOW()
          WHERE id = ${res.productId}
        `;
      }
    });
  }

  // Libera reserva quando OS é cancelada
  async releaseReservation(serviceOrderId: string, userId?: string): Promise<void> {
    await prisma.stockReservation.updateMany({
      where: { serviceOrderId, status: 'ACTIVE' },
      data: { status: 'RELEASED', releasedAt: new Date() },
    });
    await audit({ entity: 'StockReservation', action: 'RESERVATION_RELEASED', after: { serviceOrderId }, userId });
  }

  async listMovements(params: {
    companyId: string;
    productId?: string;
    serviceOrderId?: string;
    type?: MovementType;
    page?: number;
    limit?: number;
  }) {
    const { page, limit, skip } = parsePagination(params);
    const where: Record<string, unknown> = { companyId: params.companyId };
    if (params.productId) where.productId = params.productId;
    if (params.serviceOrderId) where.serviceOrderId = params.serviceOrderId;
    if (params.type) where.type = params.type;

    const [data, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { product: { select: { id: true, name: true, sku: true } } },
      }),
      prisma.stockMovement.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async lowStockAlert(companyId: string) {
    const products = await prisma.product.findMany({
      where: { companyId, minStock: { gt: 0 } },
      select: { id: true, name: true, sku: true, minStock: true },
    });

    const alerts = await Promise.all(
      products.map(async (p) => {
        const balance = await this.getBalance(p.id);
        return { ...p, available: balance.available, physical: balance.physical, reserved: balance.reserved };
      }),
    );

    return alerts.filter((p) => p.available <= p.minStock);
  }

  async recalculateBalance(productId: string): Promise<number> {
    const result = await prisma.$queryRaw<Array<{ balance: number }>>`
      SELECT COALESCE(SUM(
        CASE
          WHEN type IN ('IN', 'RETURN') THEN quantity
          WHEN type = 'ADJUSTMENT'      THEN quantity
          WHEN type IN ('OUT', 'TRANSFER', 'LOSS') THEN -quantity
          ELSE 0
        END
      ), 0)::int AS balance
      FROM "StockMovement"
      WHERE "productId" = ${productId}
    `;
    return result[0]?.balance ?? 0;
  }
}
