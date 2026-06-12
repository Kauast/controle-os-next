import { MovementType, Prisma, Product, StockReservationStatus } from '@prisma/client';
import { AppError } from '../../../lib/errors';
import { prisma, PrismaTransaction } from '../../../lib/prisma';
import { RequestContext } from '../../../shared/context/requestContext';

const NEGATIVE_MOVEMENTS = new Set<MovementType>([
  MovementType.OUT,
  MovementType.TRANSFER,
  MovementType.LOSS,
]);

function calculateRealStock(rows: Array<{ type: MovementType; _sum: { quantity: number | null } }>) {
  return rows.reduce((total, row) => {
    const quantity = row._sum.quantity ?? 0;
    if (row.type === MovementType.ADJUSTMENT) {
      return total + quantity;
    }
    return NEGATIVE_MOVEMENTS.has(row.type) ? total - quantity : total + quantity;
  }, 0);
}

export class StockService {
  async getProductBalance(productId: string, tx: PrismaTransaction = prisma) {
    const [movementSummary, reservationSummary] = await Promise.all([
      tx.stockMovement.groupBy({
        by: ['type'],
        where: { productId },
        _sum: { quantity: true },
      }),
      tx.stockReservation.findMany({
        where: {
          productId,
          status: StockReservationStatus.RESERVED,
          deletedAt: null,
        },
        select: { quantity: true, consumedQuantity: true },
      }),
    ]);

    const real = calculateRealStock(movementSummary);
    const reserved = reservationSummary.reduce((sum, row) => sum + (row.quantity - row.consumedQuantity), 0);
    const available = real - reserved;

    return { real, reserved, available };
  }

  async syncCachedStockQuantity(tx: PrismaTransaction, productId: string) {
    const balance = await this.getProductBalance(productId, tx);
    await tx.product.update({
      where: { id: productId },
      data: { stockQuantity: balance.real },
    });
    return balance;
  }

  async createMovement(input: {
    product: Product;
    quantity: number;
    type?: MovementType;
    reason: string;
    serviceOrderId?: string;
    reservationId?: string;
    userId?: string;
    tx?: PrismaTransaction;
  }) {
    const context = RequestContext.get();
    const tenantId = context.tenantId;
    if (!tenantId) throw new AppError('Tenant não resolvido', 400);

    const run = async (tx: PrismaTransaction) => {
      const currentBalance = await this.getProductBalance(input.product.id, tx);
      const movementType = input.type ?? (input.quantity >= 0 ? MovementType.IN : MovementType.OUT);
      const absoluteQty = Math.abs(input.quantity);
      const nextReal = movementType === MovementType.ADJUSTMENT
        ? currentBalance.real + input.quantity
        : NEGATIVE_MOVEMENTS.has(movementType)
          ? currentBalance.real - absoluteQty
          : currentBalance.real + absoluteQty;

      if (nextReal < 0) {
        throw new AppError('Estoque real não pode ficar negativo', 409);
      }

      const result = await tx.product.updateMany({
        where: { id: input.product.id, version: input.product.version, deletedAt: null },
        data: { version: { increment: 1 } },
      });

      if (result.count === 0) {
        throw new AppError('Conflito de concorrência ao atualizar estoque', 409);
      }

      await tx.stockMovement.create({
        data: {
          tenantId,
          productId: input.product.id,
          type: movementType,
          quantity: movementType === MovementType.ADJUSTMENT ? input.quantity : absoluteQty,
          reason: input.reason,
          serviceOrderId: input.serviceOrderId,
          reservationId: input.reservationId,
          userId: input.userId ?? context.userId,
        },
      });

      return this.syncCachedStockQuantity(tx, input.product.id);
    };

    if (input.tx) {
      return run(input.tx);
    }

    return prisma.$transaction(run);
  }

  async reserveStock(input: {
    productId: string;
    serviceOrderId?: string;
    materialRequestId?: string;
    quantity: number;
  }) {
    const tenantId = RequestContext.get().tenantId;
    if (!tenantId) throw new AppError('Tenant não resolvido', 400);

    return prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: { id: input.productId, tenantId, deletedAt: null },
      });
      if (!product) throw new AppError('Produto não encontrado', 404);

      const balance = await this.getProductBalance(product.id, tx);
      if (balance.available < input.quantity) {
        throw new AppError('Saldo disponível insuficiente para reserva', 409);
      }

      const updated = await tx.product.updateMany({
        where: { id: product.id, version: product.version, deletedAt: null },
        data: { version: { increment: 1 } },
      });
      if (updated.count === 0) {
        throw new AppError('Conflito de concorrência ao reservar estoque', 409);
      }

      return tx.stockReservation.create({
        data: {
          tenantId,
          productId: product.id,
          serviceOrderId: input.serviceOrderId,
          materialRequestId: input.materialRequestId,
          quantity: input.quantity,
          createdById: RequestContext.get().userId,
        },
      });
    });
  }

  async consumeReservation(reservationId: string, quantity?: number, transaction?: PrismaTransaction) {
    const run = async (tx: PrismaTransaction) => {
      const reservation = await tx.stockReservation.findFirst({
        where: { id: reservationId, deletedAt: null },
        include: { product: true },
      });
      if (!reservation) throw new AppError('Reserva não encontrada', 404);
      if (reservation.status !== StockReservationStatus.RESERVED) {
        throw new AppError('Reserva não está disponível para consumo', 409);
      }

      const remaining = reservation.quantity - reservation.consumedQuantity;
      const consumeQty = quantity ?? remaining;
      if (consumeQty <= 0 || consumeQty > remaining) {
        throw new AppError('Quantidade inválida para consumo da reserva', 400);
      }

      const movement = await this.createMovement({
        product: reservation.product,
        quantity: -consumeQty,
        type: MovementType.OUT,
        reason: 'Consumo de material reservado',
        reservationId: reservation.id,
        serviceOrderId: reservation.serviceOrderId ?? undefined,
        tx,
      });

      await tx.stockReservation.updateMany({
        where: { id: reservation.id, version: reservation.version, deletedAt: null },
        data: {
          consumedQuantity: { increment: consumeQty },
          status: consumeQty === remaining ? StockReservationStatus.CONSUMED : StockReservationStatus.RESERVED,
          version: { increment: 1 },
        },
      });

      return movement;
    };

    if (transaction) {
      return run(transaction);
    }

    return prisma.$transaction(run);
  }

  async releaseReservation(reservationId: string, transaction?: PrismaTransaction) {
    const executor = transaction ?? prisma;
    const reservation = await executor.stockReservation.findFirst({
      where: { id: reservationId, deletedAt: null },
    });
    if (!reservation) throw new AppError('Reserva não encontrada', 404);

    const updated = await executor.stockReservation.updateMany({
      where: { id: reservation.id, version: reservation.version, deletedAt: null },
      data: {
        status: StockReservationStatus.RELEASED,
        version: { increment: 1 },
      },
    });

    if (updated.count === 0) {
      throw new AppError('Conflito de concorrência ao liberar reserva', 409);
    }

    return executor.stockReservation.findFirst({ where: { id: reservation.id } });
  }
}
