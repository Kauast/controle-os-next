import { prisma } from '../../lib/prisma';
import { NotFoundError, InsufficientStockError } from '../../lib/errors';
import { parsePagination, buildPaginatedResult } from '../../lib/pagination';
import { publish } from '../../lib/publisher';
import { stockReservationTotal } from '../../lib/metrics';
import type { CreateMovementInput, CreateReservationInput, ListMovementsQuery } from './stock.schema';

export interface StockBalance {
  productId: string;
  physical: number;
  reserved: number;
  available: number;
}

interface ProductRow {
  id: string;
  currentBalance: number;
}

export class StockService {
  // ── Saldo ──────────────────────────────────────────────────────────────────

  async getBalance(companyId: string, productId: string): Promise<StockBalance> {
    const product = await prisma.product.findFirst({
      where: { id: productId, companyId, deletedAt: null },
      select: { currentBalance: true },
    });
    if (!product) throw new NotFoundError('Produto');

    const reservedAgg = await prisma.stockReservation.aggregate({
      where: { productId, companyId, status: 'ACTIVE' },
      _sum: { quantity: true },
    });
    const reserved = reservedAgg._sum.quantity ?? 0;

    return {
      productId,
      physical: product.currentBalance,
      reserved,
      available: Math.max(0, product.currentBalance - reserved),
    };
  }

  // ── Movimentacao manual ────────────────────────────────────────────────────

  async createMovement(
    companyId: string,
    userId: string,
    userName: string,
    input: CreateMovementInput,
  ) {
    const { productId, type, quantity, note } = input;

    return prisma.$transaction(async (tx) => {
      // Lock pessimista: serializa movimentacoes concorrentes por produto
      const rows = await tx.$queryRaw<ProductRow[]>`
        SELECT id, "currentBalance"
        FROM "Product"
        WHERE id = ${productId}
          AND "companyId" = ${companyId}
          AND "deletedAt" IS NULL
        FOR UPDATE
      `;
      if (!rows.length) throw new NotFoundError('Produto');

      const { currentBalance } = rows[0];
      const isDecrease = type === 'OUT';

      if (isDecrease && currentBalance < quantity) {
        throw new InsufficientStockError(productId, currentBalance, quantity);
      }

      const balanceBefore = currentBalance;
      const balanceAfter = isDecrease ? balanceBefore - quantity : balanceBefore + quantity;

      const movement = await tx.stockMovement.create({
        data: {
          companyId,
          productId,
          type,
          quantity,
          balanceBefore,
          balanceAfter,
          note,
          userId,
          userName,
        },
      });

      await tx.product.update({
        where: { id: productId },
        data: { currentBalance: balanceAfter },
      });

      // Verificar se ficou abaixo do minimo — publicar fora da transacao
      const productData = await tx.product.findUnique({
        where: { id: productId },
        select: { minStock: true, name: true },
      });
      if (productData && productData.minStock > 0 && balanceAfter < productData.minStock) {
        setImmediate(() => {
          publish('stock.below_min', {
            companyId,
            productId,
            productName: productData.name,
            currentBalance: balanceAfter,
            minStock: productData.minStock,
            timestamp: new Date().toISOString(),
          }).catch((err) => console.error('[publisher] stock.below_min falhou:', err));
        });
      }

      return movement;
    });
  }

  // ── Reserva (CRITICO: lock pessimista) ────────────────────────────────────

  async createReservation(
    companyId: string,
    userId: string,
    input: CreateReservationInput,
  ): Promise<{ reservationId: string }> {
    const { productId, serviceOrderId, quantity } = input;

    const reservation = await prisma.$transaction(async (tx) => {
      // SELECT FOR UPDATE: garante que nenhuma outra transacao leia o mesmo produto
      // simultaneamente ate que esta transacao seja concluida. Previne saldo negativo.
      const rows = await tx.$queryRaw<ProductRow[]>`
        SELECT id, "currentBalance"
        FROM "Product"
        WHERE id = ${productId}
          AND "companyId" = ${companyId}
          AND "deletedAt" IS NULL
        FOR UPDATE
      `;
      if (!rows.length) throw new NotFoundError('Produto');

      const { currentBalance } = rows[0];

      // Somar reservas ativas dentro da transacao para leitura consistente
      const reservedAgg = await tx.stockReservation.aggregate({
        where: { productId, companyId, status: 'ACTIVE' },
        _sum: { quantity: true },
      });
      const reserved = reservedAgg._sum.quantity ?? 0;
      const available = Math.max(0, currentBalance - reserved);

      if (available < quantity) {
        throw new InsufficientStockError(productId, available, quantity);
      }

      return tx.stockReservation.create({
        data: {
          companyId,
          productId,
          serviceOrderId,
          quantity,
          status: 'ACTIVE',
        },
      });
    });

    stockReservationTotal.inc({ result: 'success' });

    await publish('stock.reserved', {
      companyId,
      reservationId: reservation.id,
      productId,
      serviceOrderId,
      quantity,
      userId,
      timestamp: new Date().toISOString(),
    });

    return { reservationId: reservation.id };
  }

  // ── Consumir reserva individual ───────────────────────────────────────────

  async consumeReservation(
    companyId: string,
    reservationId: string,
    userId: string,
    userName: string,
  ) {
    let savedReservation: { productId: string; serviceOrderId: string; quantity: number } | null = null;

    await prisma.$transaction(async (tx) => {
      const reservation = await tx.stockReservation.findFirst({
        where: { id: reservationId, companyId, status: 'ACTIVE' },
      });
      if (!reservation) throw new NotFoundError('Reserva ativa');

      savedReservation = reservation;

      // Lock no produto antes de decrementar saldo
      const rows = await tx.$queryRaw<ProductRow[]>`
        SELECT id, "currentBalance"
        FROM "Product"
        WHERE id = ${reservation.productId}
          AND "companyId" = ${companyId}
        FOR UPDATE
      `;
      if (!rows.length) throw new NotFoundError('Produto');

      const { currentBalance } = rows[0];

      if (currentBalance < reservation.quantity) {
        throw new InsufficientStockError(reservation.productId, currentBalance, reservation.quantity);
      }

      const balanceAfter = currentBalance - reservation.quantity;

      await tx.stockMovement.create({
        data: {
          companyId,
          productId: reservation.productId,
          type: 'OUT',
          quantity: reservation.quantity,
          balanceBefore: currentBalance,
          balanceAfter,
          note: `Consumo da reserva ${reservationId} - OS ${reservation.serviceOrderId}`,
          serviceOrderId: reservation.serviceOrderId,
          userId,
          userName,
        },
      });

      await tx.product.update({
        where: { id: reservation.productId },
        data: { currentBalance: balanceAfter },
      });

      await tx.stockReservation.update({
        where: { id: reservationId },
        data: { status: 'CONSUMED' },
      });
    });

    await publish('stock.consumed', {
      companyId,
      reservationId,
      productId: savedReservation!.productId,
      serviceOrderId: savedReservation!.serviceOrderId,
      quantity: savedReservation!.quantity,
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  // ── Liberar reserva individual (compensacao de saga) ──────────────────────

  async releaseReservation(companyId: string, reservationId: string, userId: string) {
    const reservation = await prisma.stockReservation.findFirst({
      where: { id: reservationId, companyId, status: 'ACTIVE' },
    });
    if (!reservation) throw new NotFoundError('Reserva ativa');

    await prisma.stockReservation.update({
      where: { id: reservationId },
      data: { status: 'RELEASED' },
    });

    await publish('stock.released', {
      companyId,
      reservationId,
      productId: reservation.productId,
      serviceOrderId: reservation.serviceOrderId,
      quantity: reservation.quantity,
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  // ── Liberar todas as reservas de uma OS (handler de os.cancelled) ─────────

  async releaseAllReservationsByOrder(companyId: string, serviceOrderId: string) {
    const reservations = await prisma.stockReservation.findMany({
      where: { companyId, serviceOrderId, status: 'ACTIVE' },
    });

    for (const res of reservations) {
      await prisma.stockReservation.update({
        where: { id: res.id },
        data: { status: 'RELEASED' },
      });

      await publish('stock.released', {
        companyId,
        reservationId: res.id,
        productId: res.productId,
        serviceOrderId,
        quantity: res.quantity,
        userId: 'system',
        reason: 'os.cancelled',
        timestamp: new Date().toISOString(),
      });
    }
  }

  // ── Consumir todas as reservas de uma OS (handler de os.completed) ────────

  async consumeAllReservationsByOrder(
    companyId: string,
    serviceOrderId: string,
    userId: string,
  ) {
    const reservations = await prisma.stockReservation.findMany({
      where: { companyId, serviceOrderId, status: 'ACTIVE' },
    });

    for (const res of reservations) {
      await this.consumeReservation(companyId, res.id, userId, 'system');
    }
  }

  // ── Listagem de movimentos ─────────────────────────────────────────────────

  async listMovements(companyId: string, query: ListMovementsQuery) {
    const { page, limit, skip } = parsePagination(query);

    const where: Record<string, unknown> = { companyId };
    if (query.productId) where.productId = query.productId;
    if (query.serviceOrderId) where.serviceOrderId = query.serviceOrderId;
    if (query.type) where.type = query.type;

    const [data, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { product: { select: { id: true, name: true, unit: true } } },
      }),
      prisma.stockMovement.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }
}
